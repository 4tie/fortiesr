// Loading component - reusable UI primitive
// Self-contained HTML/CSS/JS component

export class Loading {
  constructor({ message = 'Loading...' } = {}) {
    this.message = message;
    this.element = null;
  }

  render() {
    const loading = document.createElement('div');
    loading.className = 'loading';

    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';

    const text = document.createElement('span');
    text.className = 'loading-text';
    text.textContent = this.message;

    loading.appendChild(spinner);
    loading.appendChild(text);

    this.element = loading;
    return loading;
  }

  update(props) {
    if (props.message !== undefined) {
      this.message = props.message;
      const textElement = this.element.querySelector('.loading-text');
      if (textElement) {
        textElement.textContent = this.message;
      }
    }
  }

  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}
