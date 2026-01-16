/**
 * D365 CCaaS Dialer Helper - Content Script v2.0.8
 * Enterprise-grade automatic country selection
 * 
 * Features:
 * - Multi-selector fallback with confidence scoring
 * - Retry logic with exponential backoff
 * - Input sanitization
 * - Debug logging system
 * - High-volume contact center optimized
 */

(function() {
  "use strict";

  // ===========================================
  // CONFIGURATION
  // ===========================================
  const VERSION = "2.0.8";
  const DEBUG = false; // Set to true for verbose logging
  
  const CONFIG = {
    MAX_RETRIES: 3,
    RETRY_DELAYS: [200, 500, 1000], // Exponential backoff
    DEBOUNCE_MS: 500,
    INITIAL_CHECK_DELAY: 300,
    DROPDOWN_WAIT: 200
  };

  // ===========================================
  // LOGGING SYSTEM
  // ===========================================
  const Logger = {
    prefix: "📞 D365 Dialer",
    
    info: function(msg, data) {
      console.log(this.prefix + " | " + msg, data !== undefined ? data : "");
    },
    
    debug: function(msg, data) {
      if (DEBUG) {
        console.log(this.prefix + " [DEBUG] | " + msg, data !== undefined ? data : "");
      }
    },
    
    success: function(msg, data) {
      console.log(this.prefix + " ✅ | " + msg, data !== undefined ? data : "");
    },
    
    warn: function(msg, data) {
      console.warn(this.prefix + " ⚠️ | " + msg, data !== undefined ? data : "");
    },
    
    error: function(msg, data) {
      console.error(this.prefix + " ❌ | " + msg, data !== undefined ? data : "");
    }
  };

  // ===========================================
  // NO FRAME FILTERING - Run in ALL frames
  // The MutationObserver will only find the element in the right frame
  // ===========================================
  Logger.debug("Running in frame:", window.location.href);

  Logger.info("v" + VERSION + " Active - Watching all frames");

  // ===========================================
  // MULTI-SELECTOR DETECTION (Survives MS Updates)
  // ===========================================
  const SELECTORS = [
    // Primary - exact ID match (highest confidence)
    { 
      selector: '#CRM-Omnichannel-Control-Dialer-regionComboBox-data-automation-id',
      confidence: 100,
      name: 'exact-id'
    },
    // Secondary - partial ID match
    {
      selector: '[id*="regionComboBox"][id*="Dialer"]',
      confidence: 90,
      name: 'partial-id'
    },
    // Tertiary - placeholder match
    {
      selector: 'input[placeholder="Country/region"]',
      confidence: 85,
      name: 'placeholder-exact'
    },
    {
      selector: 'input[placeholder*="Country"]',
      confidence: 70,
      name: 'placeholder-partial'
    },
    // Fallback - aria labels
    {
      selector: 'input[aria-label*="Country"]',
      confidence: 65,
      name: 'aria-country'
    },
    {
      selector: 'input[aria-label*="region"]',
      confidence: 60,
      name: 'aria-region'
    },
    // Last resort - role-based
    {
      selector: '[data-automation-id*="region"] input[role="combobox"]',
      confidence: 50,
      name: 'automation-id'
    }
  ];

  // ===========================================
  // SETTINGS
  // ===========================================
  let SETTINGS = {
    countryName: "United States",
    dialCode: "+1",
    enabled: true,
    showToast: true
  };

  const processed = new WeakSet();

  // Load settings
  chrome.storage.sync.get(SETTINGS, function(stored) {
    SETTINGS = Object.assign({}, SETTINGS, stored);
    Logger.debug("Settings loaded:", SETTINGS.countryName);
  });

  // Listen for changes
  chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === "sync") {
      Object.keys(changes).forEach(function(key) {
        if (SETTINGS.hasOwnProperty(key)) {
          SETTINGS[key] = changes[key].newValue;
        }
      });
      Logger.debug("Settings updated");
    }
  });

  // ===========================================
  // INPUT SANITIZATION
  // ===========================================
  function sanitizeInput(str) {
    if (!str || typeof str !== 'string') {
      return '';
    }
    // Remove any HTML tags and trim
    return str.replace(/<[^>]*>/g, '').trim().substring(0, 100);
  }

  function isValidCountryName(name) {
    if (!name || typeof name !== 'string') return false;
    if (name.length < 2 || name.length > 100) return false;
    // Only allow letters, spaces, and common punctuation
    return /^[a-zA-Z\s\-\(\)\.,']+$/.test(name);
  }

  // ===========================================
  // SMART ELEMENT FINDER (with confidence scoring)
  // ===========================================
  function findCountryInput() {
    let bestMatch = null;
    let bestConfidence = 0;
    let matchedSelector = null;

    for (let i = 0; i < SELECTORS.length; i++) {
      const config = SELECTORS[i];
      try {
        const element = document.querySelector(config.selector);
        if (element) {
          // Validate it's actually visible
          const rect = element.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            if (config.confidence > bestConfidence) {
              bestMatch = element;
              bestConfidence = config.confidence;
              matchedSelector = config.name;
            }
          }
        }
      } catch (e) {
        Logger.debug("Selector error:", config.name);
      }
    }

    if (bestMatch) {
      Logger.debug("Found element with confidence " + bestConfidence + "%:", matchedSelector);
    }

    return { element: bestMatch, confidence: bestConfidence, selector: matchedSelector };
  }

  // ===========================================
  // FILL DIAL CODE IN PHONE NUMBER INPUT
  // ===========================================
  function fillDialCode(dialCode) {
    if (!dialCode) return;
    
    // Find the phone number input by its ID
    const phoneInput = document.querySelector('#CRM-Omnichannel-Control-Dialer-nationalNumberInput-data-automation-id');
    
    if (!phoneInput) {
      Logger.debug("Phone number input not found");
      return;
    }
    
    // Only fill if empty
    if (phoneInput.value && phoneInput.value.trim() !== '') {
      Logger.debug("Phone input already has value, skipping dial code fill");
      return;
    }
    
    try {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      ).set;
      
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(phoneInput, dialCode);
        phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
        phoneInput.dispatchEvent(new Event('change', { bubbles: true }));
        Logger.success("Dial code filled: " + dialCode);
      }
    } catch (error) {
      Logger.debug("Could not fill dial code:", error.message);
    }
  }

  // ===========================================
  // RETRY LOGIC WITH EXPONENTIAL BACKOFF
  // ===========================================
  function selectCountryWithRetry(input, attempt) {
    attempt = attempt || 0;
    
    if (attempt >= CONFIG.MAX_RETRIES) {
      Logger.error("Failed after " + CONFIG.MAX_RETRIES + " attempts");
      showToast(null, null, true); // Show error toast
      return;
    }

    Logger.debug("Attempt " + (attempt + 1) + "/" + CONFIG.MAX_RETRIES);

    var success = trySelectCountry(input);
    
    if (!success && attempt < CONFIG.MAX_RETRIES - 1) {
      var delay = CONFIG.RETRY_DELAYS[attempt] || 1000;
      Logger.debug("Retrying in " + delay + "ms...");
      setTimeout(function() {
        selectCountryWithRetry(input, attempt + 1);
      }, delay);
    }
  }

  // ===========================================
  // CORE SELECTION LOGIC
  // ===========================================
  function trySelectCountry(input) {
    if (!input || !SETTINGS.enabled) return false;
    
    var countryName = sanitizeInput(SETTINGS.countryName);
    
    if (!isValidCountryName(countryName)) {
      Logger.error("Invalid country name:", countryName);
      return false;
    }

    Logger.info("Selecting:", countryName);
    
    try {
      var nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      ).set;
      
      if (!nativeInputValueSetter) {
        Logger.error("Could not get native input setter");
        return false;
      }
      
      // Set value directly
      nativeInputValueSetter.call(input, countryName);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Delay then select from dropdown
      setTimeout(function() {
        var listbox = document.querySelector('[role="listbox"]');
        var selected = false;
        
        if (listbox) {
          var options = listbox.querySelectorAll('[role="option"]');
          Logger.debug("Found " + options.length + " options in dropdown");
          
          for (var i = 0; i < options.length; i++) {
            var option = options[i];
            var text = option.textContent || '';
            if (text.toLowerCase().indexOf(countryName.toLowerCase()) !== -1) {
              option.click();
              selected = true;
              Logger.debug("Clicked option:", text);
              break;
            }
          }
        } else {
          Logger.debug("No listbox found, value was set directly");
          selected = true; // Value was set, even if no dropdown
        }
        
        input.blur();
        
        if (selected) {
          Logger.success("Country selected: " + countryName);
          
          // Also populate the phone number input with the dial code
          fillDialCode(SETTINGS.dialCode);
          
          if (SETTINGS.showToast) {
            showToast(countryName, SETTINGS.dialCode, false);
          }
        }
      }, CONFIG.DROPDOWN_WAIT);
      
      return true;
      
    } catch (error) {
      Logger.error("Selection error:", error.message);
      return false;
    }
  }

  // ===========================================
  // UNIFIED TOAST NOTIFICATION
  // ===========================================
  function showToast(country, dialCode, isError) {
    try {
      var targetDoc = window.top.document;
      var targetHead = targetDoc.head;
      var targetBody = targetDoc.body;
      
      // Clean up existing toast
      var existing = targetDoc.getElementById("d365-toast");
      if (existing) existing.remove();
      var existingStyle = targetDoc.getElementById("d365-toast-style");
      if (existingStyle) existingStyle.remove();

      var toast = targetDoc.createElement("div");
      toast.id = "d365-toast";
      
      var flag = isError ? '⚠️' : getFlag(country);
      var title = isError ? 'Selection Failed' : 'Country/Region Selected';
      var message = isError 
        ? 'Could not auto-select country. Please select manually.'
        : '<span class="toast-flag">' + flag + '</span><span>' + sanitizeInput(country) + ' (' + sanitizeInput(dialCode) + ')</span>';
      var accentColor = isError ? '#d13438' : '#0078d4';
      
      var style = targetDoc.createElement("style");
      style.id = "d365-toast-style";
      style.textContent = '\
        #d365-toast {\
          position: fixed;\
          top: 12px;\
          right: 12px;\
          z-index: 9999999;\
          display: flex;\
          align-items: stretch;\
          min-width: 320px;\
          max-width: 400px;\
          background: #323130;\
          border-radius: 4px;\
          box-shadow: 0 6.4px 14.4px 0 rgba(0,0,0,.132), 0 1.2px 3.6px 0 rgba(0,0,0,.108);\
          font-family: Segoe UI, -apple-system, BlinkMacSystemFont, sans-serif;\
          overflow: hidden;\
          animation: d365ToastIn 0.3s cubic-bezier(0.1, 0.9, 0.2, 1);\
        }\
        #d365-toast .toast-accent {\
          width: 4px;\
          background: ' + accentColor + ';\
          flex-shrink: 0;\
        }\
        #d365-toast .toast-content {\
          display: flex;\
          align-items: center;\
          gap: 12px;\
          padding: 12px 16px;\
          flex: 1;\
        }\
        #d365-toast .toast-icon {\
          width: 20px;\
          height: 20px;\
          flex-shrink: 0;\
        }\
        #d365-toast .toast-icon svg {\
          width: 20px;\
          height: 20px;\
        }\
        #d365-toast .toast-body {\
          flex: 1;\
          min-width: 0;\
        }\
        #d365-toast .toast-title {\
          font-size: 14px;\
          font-weight: 600;\
          color: #ffffff;\
          margin-bottom: 2px;\
        }\
        #d365-toast .toast-message {\
          font-size: 12px;\
          color: #d2d0ce;\
          display: flex;\
          align-items: center;\
          gap: 6px;\
        }\
        #d365-toast .toast-flag {\
          font-size: 14px;\
          line-height: 1;\
        }\
        #d365-toast.hide {\
          animation: d365ToastOut 0.2s ease forwards;\
        }\
        @keyframes d365ToastIn {\
          from { opacity: 0; transform: translateX(48px); }\
          to { opacity: 1; transform: translateX(0); }\
        }\
        @keyframes d365ToastOut {\
          from { opacity: 1; transform: translateX(0); }\
          to { opacity: 0; transform: translateX(48px); }\
        }\
      ';
      
      var iconSvg = isError
        ? '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#d13438"/><path d="M12 7v6M12 16v1" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#0078d4"/><path d="M8 12l3 3 5-6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      
      toast.innerHTML = '\
        <div class="toast-accent"></div>\
        <div class="toast-content">\
          <div class="toast-icon">' + iconSvg + '</div>\
          <div class="toast-body">\
            <div class="toast-title">' + title + '</div>\
            <div class="toast-message">' + message + '</div>\
          </div>\
        </div>\
      ';
      
      targetHead.appendChild(style);
      targetBody.appendChild(toast);
      
      Logger.debug("Toast displayed");
      
      // Auto dismiss
      var dismissTime = isError ? 4000 : 2500;
      setTimeout(function() {
        if (targetDoc.getElementById("d365-toast")) {
          toast.classList.add("hide");
          setTimeout(function() {
            toast.remove();
            style.remove();
          }, 200);
        }
      }, dismissTime);
    } catch (e) {
      Logger.debug("Toast error (cross-origin):", e.message);
    }
  }

  // ===========================================
  // FLAG LOOKUP
  // ===========================================
  var FLAGS = {
    'United States': '🇺🇸', 'Australia': '🇦🇺', 'United Kingdom': '🇬🇧',
    'Canada': '🇨🇦', 'Germany': '🇩🇪', 'France': '🇫🇷', 'India': '🇮🇳',
    'Japan': '🇯🇵', 'China': '🇨🇳', 'Brazil': '🇧🇷', 'Mexico': '🇲🇽',
    'Spain': '🇪🇸', 'Italy': '🇮🇹', 'Netherlands': '🇳🇱', 'Singapore': '🇸🇬',
    'South Korea': '🇰🇷', 'New Zealand': '🇳🇿', 'Ireland': '🇮🇪',
    'Switzerland': '🇨🇭', 'Sweden': '🇸🇪', 'Norway': '🇳🇴', 'Denmark': '🇩🇰',
    'Finland': '🇫🇮', 'Belgium': '🇧🇪', 'Austria': '🇦🇹', 'Poland': '🇵🇱',
    'Portugal': '🇵🇹', 'Russia': '🇷🇺', 'South Africa': '🇿🇦', 'UAE': '🇦🇪',
    'Saudi Arabia': '🇸🇦', 'Israel': '🇮🇱', 'Philippines': '🇵🇭',
    'Malaysia': '🇲🇾', 'Thailand': '🇹🇭', 'Indonesia': '🇮🇩', 'Vietnam': '🇻🇳',
    'Argentina': '🇦🇷', 'Chile': '🇨🇱', 'Colombia': '🇨🇴', 'Peru': '🇵🇪',
    'Egypt': '🇪🇬', 'Nigeria': '🇳🇬', 'Kenya': '🇰🇪', 'Pakistan': '🇵🇰',
    'Bangladesh': '🇧🇩', 'Turkey': '🇹🇷', 'Greece': '🇬🇷', 'Czech Republic': '🇨🇿',
    'Romania': '🇷🇴', 'Hungary': '🇭🇺'
  };

  function getFlag(country) {
    return FLAGS[country] || '🌍';
  }

  // ===========================================
  // HIGH-VOLUME CONTACT CENTER DETECTION
  // ===========================================
  Logger.info("Auto-detection active (enterprise mode)");

  var lastProcessTime = 0;
  var mutationCount = 0;

  var observer = new MutationObserver(function(mutations) {
    mutationCount++;
    
    if (!SETTINGS.enabled) return;
    
    // Log every 50th mutation to avoid spam
    if (mutationCount % 50 === 0) {
      Logger.debug("Mutation #" + mutationCount + ", checking for input...");
    }
    
    // Debounce rapid mutations - reduced to 200ms
    var now = Date.now();
    if (now - lastProcessTime < 200) return;
    
    var result = findCountryInput();
    
    if (result.element) {
      Logger.debug("Found element! Checking if processed...");
      if (!processed.has(result.element)) {
        var rect = result.element.getBoundingClientRect();
        Logger.debug("Element rect: " + rect.width + "x" + rect.height);
        if (rect.width > 0 && rect.height > 0) {
          lastProcessTime = now;
          processed.add(result.element);
          Logger.info("🎯 Input detected! Confidence: " + result.confidence + "% (" + result.selector + ")");
          setTimeout(function() {
            selectCountryWithRetry(result.element, 0);
          }, 100);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Also use a backup interval - check every 500ms
  var backupCheckInterval = setInterval(function() {
    if (!SETTINGS.enabled) return;
    
    var result = findCountryInput();
    if (result.element && !processed.has(result.element)) {
      var rect = result.element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        processed.add(result.element);
        Logger.info("🎯 Input found via backup check! Confidence: " + result.confidence + "%");
        selectCountryWithRetry(result.element, 0);
      }
    }
  }, 500);

  // One-time initial check
  setTimeout(function() {
    if (!SETTINGS.enabled) return;
    var result = findCountryInput();
    if (result.element && !processed.has(result.element)) {
      var rect = result.element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        processed.add(result.element);
        Logger.info("🎯 Initial input found! Confidence: " + result.confidence + "%");
        selectCountryWithRetry(result.element, 0);
      }
    }
  }, CONFIG.INITIAL_CHECK_DELAY);

  Logger.success("Enterprise extension ready");

})();
