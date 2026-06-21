// Button component - reusable UI primitive
// Self-contained HTML/CSS/JS component

export class Button {
  constructor({ text, onClick, variant = 'primary', disabled = false } = {}) {
    this.text = text;
    this.onClick = onClick;
    this.variant = variant;
    this.disabled = disabled;
    this.element = null;
  }

  render() {
    const button = document.createElement('button');
    button.className = `btn btn-${this.variant}`;
    button.textContent = this.text;
    button.disabled = this.disabled;

    if (this.onClick && !this.disabled) {
      button.addEventListener('click', this.onClick);
    }

    this.element = button;
    return button;
  }

  update(props) {
    if (props.text !== undefined) {
      this.text = props.text;
      this.element.textContent = this.text;
    }
    if (props.disabled !== undefined) {
      this.disabled = props.disabled;
      this.element.disabled = this.disabled;
    }
    if (props.variant !== undefined) {
      this.variant = props.variant;
      this.element.className = `btn btn-${this.variant}`;
    }
  }

  destroy() {
    if (this.element && this.onClick) {
      this.element.removeEventListener('click', this.onClick);
    }
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}
