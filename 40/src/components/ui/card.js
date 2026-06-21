// Card component - reusable UI primitive
// Self-contained HTML/CSS/JS component

export class Card {
  constructor({ title, content, footer = null } = {}) {
    this.title = title;
    this.content = content;
    this.footer = footer;
    this.element = null;
  }

  render() {
    const card = document.createElement('div');
    card.className = 'card';

    if (this.title) {
      const title = document.createElement('h3');
      title.className = 'card-title';
      title.textContent = this.title;
      card.appendChild(title);
    }

    if (this.content) {
      const content = document.createElement('div');
      content.className = 'card-content';
      
      if (typeof this.content === 'string') {
        content.textContent = this.content;
      } else if (this.content instanceof HTMLElement) {
        content.appendChild(this.content);
      }
      
      card.appendChild(content);
    }

    if (this.footer) {
      const footer = document.createElement('div');
      footer.className = 'card-footer';
      
      if (typeof this.footer === 'string') {
        footer.textContent = this.footer;
      } else if (this.footer instanceof HTMLElement) {
        footer.appendChild(this.footer);
      }
      
      card.appendChild(footer);
    }

    this.element = card;
    return card;
  }

  update(props) {
    if (props.title !== undefined) {
      this.title = props.title;
      const titleElement = this.element.querySelector('.card-title');
      if (titleElement) {
        titleElement.textContent = this.title;
      }
    }
    if (props.content !== undefined) {
      this.content = props.content;
      const contentElement = this.element.querySelector('.card-content');
      if (contentElement) {
        contentElement.innerHTML = '';
        if (typeof this.content === 'string') {
          contentElement.textContent = this.content;
        } else if (this.content instanceof HTMLElement) {
          contentElement.appendChild(this.content);
        }
      }
    }
  }

  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}
