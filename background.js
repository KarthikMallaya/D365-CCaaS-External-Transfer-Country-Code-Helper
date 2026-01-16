/**
 * D365 CCaaS Dialer Helper - Background Script v1.2.0
 * Handles on-demand injection into all frames
 */

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'FILL_COUNTRY') {
    fillCountryInAllFrames(message.countryName).then(result => {
      sendResponse(result);
    });
    return true; // Keep channel open for async response
  }
});

async function fillCountryInAllFrames(countryName) {
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      console.log('📞 No active tab');
      return { success: false, error: 'No active tab' };
    }

    console.log('📞 Injecting into tab:', tab.id, 'Country:', countryName);

    // Inject the fill script into ALL frames
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: fillCountryDropdown,
      args: [countryName]
    });

    console.log('📞 Injection results:', results);
    
    // Check if any frame found the element
    const foundResult = results.find(r => r.result && r.result.found);
    if (foundResult) {
      console.log('📞 Element found in frame:', foundResult.frameId);
      return { success: true, found: true };
    }
    
    return { success: true, found: false };

  } catch (error) {
    console.error('📞 Background error:', error);
    return { success: false, error: error.message };
  }
}

// This function runs in EVERY frame
function fillCountryDropdown(countryName) {
  console.log('📞 Searching in frame:', window.location.href);

  // Multiple selectors to find the country input
  const selectors = [
    '#CRM-Omnichannel-Control-Dialer-regionComboBox-data-automation-id',
    'input[placeholder="Country/region"]',
    'input[placeholder*="Country"]',
    'input[aria-label*="Country"]',
    'input[aria-label*="region"]',
    '[data-automation-id*="regionComboBox"] input',
    '[class*="region"] input[role="combobox"]',
    'input[role="combobox"]'
  ];

  let input = null;
  let matchedSelector = null;
  
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      // Check if this looks like the country dropdown
      const placeholder = el.getAttribute('placeholder') || '';
      const ariaLabel = el.getAttribute('aria-label') || '';
      const id = el.id || '';
      
      if (placeholder.toLowerCase().includes('country') ||
          ariaLabel.toLowerCase().includes('country') ||
          ariaLabel.toLowerCase().includes('region') ||
          id.toLowerCase().includes('region')) {
        input = el;
        matchedSelector = selector;
        break;
      }
    }
    if (input) break;
  }

  // Fallback: any combobox that might be the country selector
  if (!input) {
    const comboboxes = document.querySelectorAll('input[role="combobox"]');
    for (const cb of comboboxes) {
      const rect = cb.getBoundingClientRect();
      // Check if visible and reasonable size
      if (rect.width > 50 && rect.height > 20) {
        const placeholder = cb.getAttribute('placeholder') || '';
        if (placeholder.toLowerCase().includes('country') || placeholder.toLowerCase().includes('region')) {
          input = cb;
          matchedSelector = 'fallback combobox';
          break;
        }
      }
    }
  }

  if (!input) {
    console.log('📞 Input not found in this frame');
    return { found: false, frame: window.location.href };
  }

  console.log('📞 FOUND with:', matchedSelector, 'Element:', input);

  // Fill the input
  try {
    // Click to focus and potentially open dropdown
    input.click();
    input.focus();

    // Use native setter for React
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;

    // Clear and set value
    nativeInputValueSetter.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    
    setTimeout(() => {
      nativeInputValueSetter.call(input, countryName);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));

      // Wait and look for dropdown
      setTimeout(() => {
        const listbox = document.querySelector('[role="listbox"]');
        if (listbox) {
          const options = listbox.querySelectorAll('[role="option"]');
          console.log('📞 Found', options.length, 'options');
          for (const option of options) {
            const text = option.textContent || '';
            if (text.toLowerCase().includes(countryName.toLowerCase())) {
              console.log('📞 Clicking option:', text);
              option.click();
              break;
            }
          }
        } else {
          // Try keyboard navigation
          console.log('📞 No listbox, trying keyboard');
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', keyCode: 40, bubbles: true }));
          setTimeout(() => {
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
          }, 100);
        }
      }, 500);
    }, 100);

    // Show visual feedback
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    toast.innerHTML = `🌍 Country set to: <strong>${countryName}</strong>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);

    return { found: true, frame: window.location.href, selector: matchedSelector };

  } catch (error) {
    console.error('📞 Fill error:', error);
    return { found: false, error: error.message };
  }
}
