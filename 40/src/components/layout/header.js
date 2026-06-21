// Header component - layout component
// Self-contained HTML/CSS/JS component

export class Header {
  constructor({ title = '4tie', onMenuToggle } = {}) {
    this.title = title;
    this.onMenuToggle = onMenuToggle;
    this.element = null;
  }

  render() {
    const header = document.createElement('header');
    header.className = 'header';

    const brand = document.createElement('div');
    brand.className = 'header-brand';
    brand.textContent = this.title;

    const menuButton = document.createElement('button');
    menuButton.className = 'header-menu-button';
    menuButton.innerHTML = '☰';
    menuButton.setAttribute('aria-label', 'Toggle menu');

    if (this.onMenuToggle) {
      menuButton.addEventListener('click', this.onMenuToggle);
    }

    header.appendChild(brand);
    header.appendChild(menuButton);

    this.element = header;
    return header;
  }

  update(props) {
    if (props.title !== undefined) {
      this.title = props.title;
      const brandElement = this.element.querySelector('.header-brand');
      if (brandElement) {
        brandElement.textContent = this.title;
      }
    }
  }

  destroy() {
    if (this.element && this.onMenuToggle) {
      const menuButton = this.element.querySelector('.header-menu-button');
      if (menuButton) {
        menuButton.removeEventListener('click', this.onMenuToggle);
      }
    }
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}
