/**
 * D365 CCaaS Dialer Helper - Background Script v2.0.8
 * Handles dynamic frame injection and on-demand fill
 */

// ===========================================
// WATCH FOR DYNAMICALLY CREATED FRAMES
// ===========================================
chrome.webNavigation.onCompleted.addListener(async (details) => {
  const url = details.url ? details.url.toLowerCase() : '';
  
  // Check if this is the target frame (msdyn_chatcontrol)
  if (url.includes('msdyn_chatcontrol') || url.includes('chatcontrol')) {
    console.log('📞 BG: Target frame LOADED:', details.url, 'frameId:', details.frameId);
    
    // Small delay to let the frame's DOM settle
    setTimeout(async () => {
      try {
        // Get stored settings
        const settings = await chrome.storage.sync.get({
          countryName: 'United States',
          enabled: true,
          showToast: true
        });
        
        if (!settings.enabled) {
          console.log('📞 BG: Extension disabled, skipping');
          return;
        }
        
        console.log('📞 BG: Injecting auto-fill for:', settings.countryName);
        
        // Inject and execute the fill function directly
        await chrome.scripting.executeScript({
          target: { tabId: details.tabId, frameIds: [details.frameId] },
          func: autoFillCountry,
          args: [settings.countryName, settings.showToast]
        });
        
        console.log('📞 BG: Auto-fill injected successfully');
      } catch (e) {
        console.log('📞 BG: Injection error:', e.message);
      }
    }, 500);
  }
}, {
  url: [{ hostSuffix: '.dynamics.com' }]
});

// ===========================================
// AUTO-FILL FUNCTION (injected into target frame)
// ===========================================
function autoFillCountry(countryName, showToast) {
  console.log('📞 AUTO-FILL: Starting for', countryName);
  
  // Wait for element with retry
  let attempts = 0;
  const maxAttempts = 10;
  
  function tryFill() {
    attempts++;
    console.log('📞 AUTO-FILL: Attempt', attempts);
    
    const input = document.getElementById('CRM-Omnichannel-Control-Dialer-regionComboBox-data-automation-id') ||
                  document.querySelector('input[placeholder="Country/region"]') ||
                  document.querySelector('input[placeholder*="Country"]');
    
    if (!input) {
      if (attempts < maxAttempts) {
        console.log('📞 AUTO-FILL: Element not found, retrying in 300ms...');
        setTimeout(tryFill, 300);
        return;
      }
      console.log('📞 AUTO-FILL: Element not found after', maxAttempts, 'attempts');
      return;
    }
    
    console.log('📞 AUTO-FILL: Found element!', input);
    
    try {
      // Set value using native setter (for React)
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      ).set;
      
      nativeInputValueSetter.call(input, countryName);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Select from dropdown after brief delay
      setTimeout(() => {
        const listbox = document.querySelector('[role="listbox"]');
        if (listbox) {
          const options = listbox.querySelectorAll('[role="option"]');
          for (const option of options) {
            if ((option.textContent || '').toLowerCase().includes(countryName.toLowerCase())) {
              option.click();
              break;
            }
          }
        }
        input.blur();
        console.log('📞 AUTO-FILL: ✅ Success!');
        
        // Show toast
        if (showToast) {
          try {
            const targetDoc = window.top.document;
            const existing = targetDoc.getElementById('d365-toast');
            if (existing) existing.remove();
            
            const toast = targetDoc.createElement('div');
            toast.id = 'd365-toast';
            toast.style.cssText = 'position:fixed;top:12px;right:12px;z-index:9999999;display:flex;align-items:stretch;min-width:320px;background:#323130;border-radius:4px;box-shadow:0 6px 14px rgba(0,0,0,.13);font-family:Segoe UI,sans-serif;overflow:hidden;animation:toastIn .3s ease';
            toast.innerHTML = '<div style="width:4px;background:#0078d4"></div><div style="display:flex;align-items:center;gap:12px;padding:12px 16px"><div style="width:20px;height:20px"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#0078d4"/><path d="M8 12l3 3 5-6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg></div><div><div style="font-size:14px;font-weight:600;color:#fff">Country/Region Selected</div><div style="font-size:12px;color:#d2d0ce">' + countryName + '</div></div></div>';
            
            const style = targetDoc.createElement('style');
            style.textContent = '@keyframes toastIn{from{opacity:0;transform:translateX(48px)}to{opacity:1;transform:translateX(0)}}';
            targetDoc.head.appendChild(style);
            targetDoc.body.appendChild(toast);
            
            setTimeout(() => { toast.remove(); style.remove(); }, 2500);
          } catch(e) { console.log('📞 Toast error:', e); }
        }
      }, 200);
      
    } catch (e) {
      console.error('📞 AUTO-FILL: Error:', e);
    }
  }
  
  tryFill();
}

// ===========================================
// LISTEN FOR MESSAGES FROM POPUP (Fill Now button)
// ===========================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'FILL_COUNTRY') {
    fillCountryInAllFrames(message.countryName).then(result => {
      sendResponse(result);
    });
    return true;
  }
});

async function fillCountryInAllFrames(countryName) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      return { success: false, error: 'No active tab' };
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: autoFillCountry,
      args: [countryName, true]
    });

    const foundResult = results.find(r => r.result && r.result.found);
    return { success: true, found: !!foundResult };

  } catch (error) {
    console.error('📞 Background error:', error);
    return { success: false, error: error.message };
  }
}
