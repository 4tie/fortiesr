// Input component - reusable UI primitive
// Self-contained HTML/CSS/JS component

export class Input {
  constructor({ type = 'text', placeholder = '', value = '', onChange, disabled = false } = {}) {
    this.type = type;
    this.placeholder = placeholder;
    this.value = value;
    this.onChange = onChange;
    this.disabled = disabled;
    this.element = null;
  }

  render() {
    const input = document.createElement('input');
    input.type = this.type;
    input.placeholder = this.placeholder;
    input.value = this.value;
    input.disabled = this.disabled;
    input.className = 'input';

    if (this.onChange && !this.disabled) {
      input.addEventListener('input', (e) => {
        this.value = e.target.value;
        this.onChange(this.value);
      });
    }

    this.element = input;
    return input;
  }

  update(props) {
    if (props.value !== undefined) {
      this.value = props.value;
      this.element.value = this.value;
    }
    if (props.disabled !== undefined) {
      this.disabled = props.disabled;
      this.element.disabled = this.disabled;
    }
    if (props.placeholder !== undefined) {
      this.placeholder = props.placeholder;
      this.element.placeholder = this.placeholder;
    }
  }

  getValue() {
    return this.element.value;
  }

  destroy() {
    if (this.element && this.onChange) {
      this.element.removeEventListener('input', this.onChange);
    }
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}
