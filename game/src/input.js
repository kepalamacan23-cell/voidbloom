// Keyboard and mouse state for the game: what is held, what was just pressed, and where
// the pointer sits in world units. main.js reads it once a frame and hands the world a
// plain control object, so the simulation never touches the DOM itself.

/** Keys the game uses; their default actions (scroll, context menu) are suppressed. */
const GAME_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyP', 'KeyM',
  'ShiftLeft', 'ShiftRight', 'Enter', 'Escape',
]);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.held = new Set();
    this.pressed = new Set();
    this.mouse = { x: 640, y: 360, down: false, rightDown: false };
    this.clicked = false;

    window.addEventListener('keydown', (event) => {
      if (GAME_KEYS.has(event.code)) event.preventDefault();
      if (!event.repeat) this.pressed.add(event.code);
      this.held.add(event.code);
    });
    window.addEventListener('keyup', (event) => {
      this.held.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.held.clear();
      this.mouse.down = false;
      this.mouse.rightDown = false;
    });
    canvas.addEventListener('mousemove', (event) => this.#trackMouse(event));
    canvas.addEventListener('mousedown', (event) => {
      this.#trackMouse(event);
      if (event.button === 0) {
        this.mouse.down = true;
        this.clicked = true;
      }
      if (event.button === 2) this.mouse.rightDown = true;
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouse.down = false;
      if (event.button === 2) this.mouse.rightDown = false;
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  #trackMouse(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * this.canvas.width;
    this.mouse.y = ((event.clientY - rect.top) / rect.height) * this.canvas.height;
  }

  /** True while the key is down. */
  isHeld(code) {
    return this.held.has(code);
  }

  /** True only on the frame the key went down; consumes nothing, main clears each frame. */
  wasPressed(code) {
    return this.pressed.has(code);
  }

  /** The movement axis from WASD and the arrow keys, each side -1, 0 or 1. */
  moveAxis() {
    const x = (this.isHeld('KeyD') || this.isHeld('ArrowRight') ? 1 : 0)
      - (this.isHeld('KeyA') || this.isHeld('ArrowLeft') ? 1 : 0);
    const y = (this.isHeld('KeyS') || this.isHeld('ArrowDown') ? 1 : 0)
      - (this.isHeld('KeyW') || this.isHeld('ArrowUp') ? 1 : 0);
    return { x, y };
  }

  /** End-of-frame tidy-up: one-shot presses and clicks live for exactly one frame. */
  endFrame() {
    this.pressed.clear();
    this.clicked = false;
  }
}
