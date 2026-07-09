/* global require */
require('@testing-library/jest-dom');

// Polyfill for TextEncoder and TextDecoder in Jest environment
global.TextEncoder = class {
  encode(str) {
    const utf8 = [];
    for (let i = 0; i < str.length; i++) {
      let charcode = str.charCodeAt(i);
      if (charcode < 0x80) utf8.push(charcode);
      else if (charcode < 0x800) {
        utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
      } else if (charcode < 0xd800 || charcode >= 0xe000) {
        utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
      } else {
        i++;
        charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
        utf8.push(0xf0 | (charcode >> 18), 0x80 | ((charcode >> 12) & 0x3f), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
      }
    }
    return new Uint8Array(utf8);
  }
};

global.TextDecoder = class {
  decode(bytes) {
    let str = '';
    let i = 0;
    while (i < bytes.length) {
      let byte = bytes[i++];
      if (byte < 0x80) {
        str += String.fromCharCode(byte);
      } else if (byte < 0xe0) {
        str += String.fromCharCode(((byte & 0x1f) << 6) | (bytes[i++] & 0x3f));
      } else if (byte < 0xf0) {
        str += String.fromCharCode(((byte & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f));
      } else {
        str += String.fromCharCode(((byte & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f));
      }
    }
    return str;
  }
};
