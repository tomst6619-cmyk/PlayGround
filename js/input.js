export class Controls {
  constructor({ joystick, knob, action, canvas, onAction, onTap }) {
    this.axis = { x: 0, y: 0 };
    this.keys = new Set();
    this.tap = null;
    this.joystick = joystick;
    this.knob = knob;
    this.onAction = onAction;
    this.onTap = onTap;
    this.pointerId = null;

    const moveKeys = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
    addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (moveKeys.has(k)) {
        this.keys.add(k);
        e.preventDefault();
      }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());

    this.bindJoystick();
    this.bindAction(action);
    this.bindTap(canvas);
  }

  keyAxis() {
    const k = this.keys;
    let x = 0;
    let y = 0;
    if (k.has('a') || k.has('arrowleft')) x -= 1;
    if (k.has('d') || k.has('arrowright')) x += 1;
    if (k.has('w') || k.has('arrowup')) y -= 1;
    if (k.has('s') || k.has('arrowdown')) y += 1;
    this.tap = x || y ? { x, y } : null;
    return { x, y };
  }

  bindJoystick() {
    const el = this.joystick;
    if (!el) return;
    const R = 46;
    const setStick = (dx, dy) => {
      const len = Math.hypot(dx, dy);
      const cl = Math.min(len, R);
      const nx = len > 0 ? (dx / len) * (cl / R) : 0;
      const ny = len > 0 ? (dy / len) * (cl / R) : 0;
      this.axis.x = Math.abs(nx) < 0.12 ? 0 : nx;
      this.axis.y = Math.abs(ny) < 0.12 ? 0 : ny;
      this.knob.style.transform = `translate(${nx * R}px, ${ny * R}px)`;
    };
    const reset = () => {
      this.pointerId = null;
      this.axis.x = 0;
      this.axis.y = 0;
      this.knob.style.transform = 'translate(0px, 0px)';
    };

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.pointerId = e.pointerId;
      el.setPointerCapture?.(e.pointerId);
      const r = el.getBoundingClientRect();
      setStick(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
    });
    el.addEventListener('pointermove', (e) => {
      if (this.pointerId !== e.pointerId) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setStick(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
    });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
      el.addEventListener(type, (e) => {
        if (this.pointerId !== e.pointerId) return;
        reset();
      });
    }
  }

  bindAction(button) {
    if (!button) return;
    button.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!button.disabled) this.onAction?.();
    });
  }

  bindTap(canvas) {
    let start = null;
    canvas.addEventListener('pointerdown', (e) => {
      start = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    });
    canvas.addEventListener('pointerup', (e) => {
      if (!start || start.id !== e.pointerId) return;
      const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      const dt = performance.now() - start.t;
      start = null;
      if (moved < 14 && dt < 550) this.onTap?.(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointercancel', () => { start = null; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}
