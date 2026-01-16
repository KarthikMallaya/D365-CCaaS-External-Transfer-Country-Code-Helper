/**
 * D365 CCaaS Dialer Helper - Popup Script v2.0.8
 */

document.addEventListener("DOMContentLoaded", () => {
  const enabledToggle = document.getElementById("enabledToggle");
  const toastToggle = document.getElementById("toastToggle");
  const countrySelect = document.getElementById("countrySelect");
  const statusEl = document.getElementById("status");
  const statusText = document.getElementById("statusText");
  const versionEl = document.getElementById("version");
  const fillNowBtn = document.getElementById("fillNowBtn");

  // Display version from manifest
  const manifest = chrome.runtime.getManifest();
  versionEl.textContent = manifest.version;

  // Default settings
  const DEFAULT_SETTINGS = {
    countryName: "United States",
    dialCode: "+1",
    enabled: true,
    showToast: true
  };

  // Populate country dropdown
  function populateCountries() {
    countrySelect.innerHTML = "";
    
    COUNTRIES.forEach((country) => {
      const option = document.createElement("option");
      option.value = country.name;
      // Don't include flag emoji in dropdown - it doesn't render well on Windows
      // The flag is shown prominently in the preview section below
      option.textContent = country.disabled 
        ? country.name 
        : `${country.name} (${country.code})`;
      option.disabled = country.disabled || false;
      countrySelect.appendChild(option);
    });
  }

  // Update status indicator
  function updateStatus(enabled, message) {
    if (message) {
      statusText.textContent = message;
    } else if (enabled) {
      statusEl.classList.remove("disabled");
      statusText.textContent = "Ready";
    } else {
      statusEl.classList.add("disabled");
      statusText.textContent = "Disabled";
    }
  }

  // Save settings to storage
  function saveSettings(settings) {
    chrome.storage.sync.set(settings);
  }

  // Load settings from storage
  function loadSettings() {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
      // Apply settings to UI
      enabledToggle.checked = settings.enabled;
      toastToggle.checked = settings.showToast;
      countrySelect.value = settings.countryName;
      updateStatus(settings.enabled);
    });
  }

  // Fill country NOW - sends message to background
  async function fillCountryNow() {
    const selectedCountry = countrySelect.value;
    if (!selectedCountry) return;

    fillNowBtn.disabled = true;
    fillNowBtn.innerHTML = `
      <svg class="spin" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"/>
      </svg>
      Filling...
    `;
    updateStatus(true, "Searching...");

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'FILL_COUNTRY',
        countryName: selectedCountry
      });

      console.log('📞 Fill response:', response);

      if (response && response.found) {
        fillNowBtn.classList.add('success');
        fillNowBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Filled!
        `;
        updateStatus(true, "Country filled successfully!");
      } else {
        fillNowBtn.classList.add('error');
        fillNowBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          Not Found
        `;
        updateStatus(true, "Open Transfer dialog first");
      }

      // Reset button after 2 seconds
      setTimeout(() => {
        fillNowBtn.disabled = false;
        fillNowBtn.classList.remove('success', 'error');
        fillNowBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
          Fill Country Now
        `;
        updateStatus(enabledToggle.checked);
      }, 2000);

    } catch (error) {
      console.error('📞 Fill error:', error);
      fillNowBtn.disabled = false;
      fillNowBtn.classList.add('error');
      updateStatus(true, "Error: " + error.message);
    }
  }

  // Initialize
  populateCountries();
  loadSettings();

  // Event: Enable toggle
  enabledToggle.addEventListener("change", () => {
    const enabled = enabledToggle.checked;
    updateStatus(enabled);
    saveSettings({ enabled });
  });

  // Event: Toast toggle
  toastToggle.addEventListener("change", () => {
    saveSettings({ showToast: toastToggle.checked });
  });

  // Event: Country selection
  countrySelect.addEventListener("change", () => {
    const selectedCountry = countrySelect.value;
    const country = findCountry(selectedCountry);
    
    if (country) {
      saveSettings({
        countryName: country.name,
        dialCode: country.code
      });
    }
  });

  // Event: Fill Now button
  fillNowBtn.addEventListener("click", fillCountryNow);
});
