# Apple TV Keyboard Card

A custom Lovelace card for Home Assistant that provides real-time keyboard input for Apple TV.

Instead of spawning a new `atvremote` process for each keystroke, this card uses the `apple_tv_keyboard` custom component to send text through Home Assistant's existing persistent pyatv connection — giving you instant, real-time input just like the iOS Control Center remote.

## Requirements

- [apple_tv_keyboard custom component](https://github.com/mkraftman/apple-tv-keyboard) installed and configured
- Apple TV integration set up in Home Assistant

## Installation

### HACS

1. Add this repository as a custom repository in HACS (category: Lovelace)
2. Install "Mkraftman Apple TV Keyboard"
3. Add the card to your dashboard

### Manual

Copy `dist/mkraftman-appletv-keyboard.js` to `/config/www/` and add it as a Lovelace resource.

## Configuration

```yaml
type: custom:mkraftman-apple-tv-keyboard
entity: remote.apple_tv_living_room
```

| Key    | Type   | Required | Description                  |
|--------|--------|----------|------------------------------|
| entity | string | Yes      | Apple TV remote entity ID    |

## Usage

1. Tap the keyboard icon to activate
2. Type on the native keyboard — text appears on Apple TV in real-time
3. Tap X to clear text and dismiss
