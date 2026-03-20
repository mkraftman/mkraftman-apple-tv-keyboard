/**
 * mkraftman-appletv-keyboard
 * Custom HACS card for Apple TV real-time keyboard input.
 * Single keyboard icon that opens native soft keyboard and sends keystrokes via apple_tv_keyboard services.
 */

class MkraftmanAppleTVKeyboard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._el = {};
    this._built = false;
    this._active = false;
    this._throttleTimer = null;
    this._pendingText = null;
    this._lastSentTime = 0;
  }

  static getStubConfig() {
    return { entity: "remote.apple_tv_living_room" };
  }

  setConfig(config) {
    if (!config.entity) throw new Error("You must specify an 'entity'");
    this._config = config;
    if (this._hass) this._build();
  }

  getCardSize() {
    return 2;
  }

  getGridOptions() {
    return { rows: 2, columns: 12, min_rows: 2, min_columns: 6 };
  }

  getLayoutOptions() {
    return { grid_columns: 4, grid_rows: 2 };
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    if (!this._built) this._build();
  }

  _build() {
    if (this._built || !this._hass || !this._config) return;

    const shadow = this.shadowRoot;
    shadow.innerHTML = `
      <style>
        :host {
          display: block;
          height: 100%;
        }
        .card {
          background: transparent;
          border-radius: 12px;
          padding: 12px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
        }

        /* Idle state: keyboard icon */
        .kb-btn {
          width: 55px;
          height: 55px;
          border-radius: 0;
          border: none;
          background: transparent;
          color: #A9A9A9;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          transition: opacity 0.15s;
          -webkit-tap-highlight-color: transparent;
        }
        .kb-btn:active {
          opacity: 0.6;
        }
        .kb-btn ha-icon {
          --mdc-icon-size: 55px;
        }

        /* Active state: text display + clear button */
        .active-row {
          display: none;
          align-items: center;
          width: 100%;
          height: 56px;
          gap: 8px;
        }
        .active-row.visible {
          display: flex;
        }
        .text-display {
          flex: 1;
          font-size: 18px;
          font-weight: 500;
          color: var(--primary-text-color, #fff);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          user-select: none;
          height: 56px;
          line-height: 56px;
          cursor: text;
        }
        .text-display.placeholder {
          opacity: 0.4;
        }
        .clear-btn {
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background: rgba(var(--rgb-blue, 68, 115, 158), 0.2);
          color: var(--primary-text-color, #fff);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          font-size: 24px;
          font-weight: 700;
          line-height: 1;
          transition: background 0.15s;
          -webkit-tap-highlight-color: transparent;
        }
        .clear-btn:active {
          background: rgba(var(--rgb-blue, 68, 115, 158), 0.35);
        }

        /* Hidden input to capture native keyboard */
        .hidden-input {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 1px;
          opacity: 0;
          border: none;
          outline: none;
          padding: 0;
          margin: 0;
          font-size: 16px;
          color: transparent;
          caret-color: transparent;
          background: transparent;
          pointer-events: none;
          -webkit-appearance: none;
          -webkit-text-fill-color: transparent;
        }
      </style>

      <div class="card">
        <button class="kb-btn" id="kbBtn">
          <ha-icon icon="mdi:keyboard-outline"></ha-icon>
        </button>
        <div class="active-row" id="activeRow">
          <div class="text-display placeholder" id="textDisplay">Type something...</div>
          <button class="clear-btn" id="clearBtn">&times;</button>
        </div>
        <input class="hidden-input" id="hiddenInput" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
      </div>
    `;

    this._el.kbBtn = shadow.getElementById("kbBtn");
    this._el.activeRow = shadow.getElementById("activeRow");
    this._el.textDisplay = shadow.getElementById("textDisplay");
    this._el.clearBtn = shadow.getElementById("clearBtn");
    this._el.hiddenInput = shadow.getElementById("hiddenInput");

    // Tap keyboard icon → activate
    this._el.kbBtn.addEventListener("click", () => this._activate());

    // Tap text display → refocus input (keeps keyboard open)
    this._el.textDisplay.addEventListener("click", () => {
      this._el.hiddenInput.focus();
    });

    // Input events → send text
    this._el.hiddenInput.addEventListener("input", () => {
      const text = this._el.hiddenInput.value;
      this._updateTextDisplay(text);
      this._throttledSend(text);
      // Snap back to saved scroll position to prevent iOS drift
      if (this._savedScrollY !== null) {
        requestAnimationFrame(() => {
          window.scrollTo(0, this._savedScrollY);
        });
      }
    });

    // Clear button → deactivate and clear text on Apple TV
    this._el.clearBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._deactivate(true);
    });

    // When keyboard dismisses (input loses focus), deactivate UI only (keep text on Apple TV)
    this._el.hiddenInput.addEventListener("blur", () => {
      if (this._active) {
        // Small delay to allow clear button click to register first
        setTimeout(() => {
          if (this._active) {
            this._deactivate(false);
          }
        }, 200);
      }
    });

    this._built = true;
  }

  _activate() {
    this._active = true;
    this._savedScrollY = null;
    this._el.kbBtn.style.display = "none";
    this._el.activeRow.classList.add("visible");
    this._el.hiddenInput.value = "";
    this._updateTextDisplay("");
    this._el.hiddenInput.style.pointerEvents = "auto";
    this._el.hiddenInput.focus();
    // Scroll the card into view above the keyboard, then save that position
    setTimeout(() => {
      this.scrollIntoView({ behavior: "smooth", block: "end" });
      // Save the scroll position after the smooth scroll completes
      setTimeout(() => {
        this._savedScrollY = window.scrollY;
      }, 500);
    }, 300);
  }

  _deactivate(clearText) {
    this._active = false;
    this._savedScrollY = null;

    // Only clear on Apple TV if explicitly requested (clear button)
    if (clearText && this._hass && this._config) {
      this._hass.callService("apple_tv_keyboard", "text_clear", {
        entity_id: this._config.entity,
      });
    }

    // Clear any pending throttle
    if (this._throttleTimer) {
      clearTimeout(this._throttleTimer);
      this._throttleTimer = null;
      this._pendingText = null;
    }

    this._el.hiddenInput.blur();
    this._el.hiddenInput.value = "";
    this._el.hiddenInput.style.pointerEvents = "none";
    this._el.activeRow.classList.remove("visible");
    this._el.kbBtn.style.display = "flex";
    this._updateTextDisplay("");
  }

  _updateTextDisplay(text) {
    if (text.length > 0) {
      this._el.textDisplay.textContent = text;
      this._el.textDisplay.classList.remove("placeholder");
    } else {
      this._el.textDisplay.textContent = "Type something...";
      this._el.textDisplay.classList.add("placeholder");
    }
  }

  _throttledSend(text) {
    const now = Date.now();
    const elapsed = now - this._lastSentTime;

    if (elapsed >= 100) {
      this._sendText(text);
    } else {
      this._pendingText = text;
      if (!this._throttleTimer) {
        this._throttleTimer = setTimeout(() => {
          this._throttleTimer = null;
          if (this._pendingText !== null) {
            this._sendText(this._pendingText);
            this._pendingText = null;
          }
        }, 100 - elapsed);
      }
    }
  }

  _sendText(text) {
    if (!this._hass || !this._config) return;
    this._lastSentTime = Date.now();
    this._hass.callService("apple_tv_keyboard", "text_set", {
      entity_id: this._config.entity,
      text: text,
    });
  }

  connectedCallback() {
    if (this._hass && this._config && !this._built) {
      this._build();
    }
  }

  disconnectedCallback() {
    if (this._throttleTimer) {
      clearTimeout(this._throttleTimer);
      this._throttleTimer = null;
    }
    this._pendingText = null;
    this._active = false;
  }
}

customElements.define("mkraftman-apple-tv-keyboard", MkraftmanAppleTVKeyboard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "mkraftman-apple-tv-keyboard",
  name: "Mkraftman Apple TV Keyboard",
  description: "Real-time keyboard input for Apple TV using the existing persistent connection.",
});
