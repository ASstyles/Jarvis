export class InputManager {
  private keys: Map<string, boolean> = new Map();
  private keysJustPressed: Map<string, boolean> = new Map();

  public mouse = {
    x: 0,
    y: 0,
    isDown: false,
    rightIsDown: false,
    justClicked: false,
    canvasX: 0,
    canvasY: 0
  };

  private targetElement: HTMLElement | null = null;
  private keydownListener: (e: KeyboardEvent) => void;
  private keyupListener: (e: KeyboardEvent) => void;
  private mousemoveListener: (e: MouseEvent) => void;
  private mousedownListener: (e: MouseEvent) => void;
  private mouseupListener: (e: MouseEvent) => void;
  private touchstartListener: (e: TouchEvent) => void;
  private touchmoveListener: (e: TouchEvent) => void;
  private touchendListener: (e: TouchEvent) => void;

  constructor(targetElement?: HTMLElement) {
    this.targetElement = targetElement || null;

    this.keydownListener = (e: KeyboardEvent) => {
      const code = e.code.toLowerCase();
      const key = e.key.toLowerCase();
      
      if (!this.keys.get(code) && !this.keys.get(key)) {
        this.keysJustPressed.set(code, true);
        this.keysJustPressed.set(key, true);
      }
      this.keys.set(code, true);
      this.keys.set(key, true);

      // Prevent scrolling for game control keys
      if (["space", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(code)) {
        e.preventDefault();
      }
    };

    this.keyupListener = (e: KeyboardEvent) => {
      const code = e.code.toLowerCase();
      const key = e.key.toLowerCase();
      this.keys.set(code, false);
      this.keys.set(key, false);
    };

    this.mousemoveListener = (e: MouseEvent) => {
      if (this.targetElement) {
        const rect = this.targetElement.getBoundingClientRect();
        this.mouse.canvasX = e.clientX - rect.left;
        this.mouse.canvasY = e.clientY - rect.top;
      }
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    };

    this.mousedownListener = (e: MouseEvent) => {
      if (e.button === 0) {
        this.mouse.isDown = true;
        this.mouse.justClicked = true;
      } else if (e.button === 2) {
        this.mouse.rightIsDown = true;
      }
    };

    this.mouseupListener = (e: MouseEvent) => {
      if (e.button === 0) this.mouse.isDown = false;
      if (e.button === 2) this.mouse.rightIsDown = false;
    };

    this.touchstartListener = (e: TouchEvent) => {
      if (e.touches.length > 0 && this.targetElement) {
        const touch = e.touches[0];
        const rect = this.targetElement.getBoundingClientRect();
        this.mouse.canvasX = touch.clientX - rect.left;
        this.mouse.canvasY = touch.clientY - rect.top;
        this.mouse.isDown = true;
        this.mouse.justClicked = true;
      }
    };

    this.touchmoveListener = (e: TouchEvent) => {
      if (e.touches.length > 0 && this.targetElement) {
        const touch = e.touches[0];
        const rect = this.targetElement.getBoundingClientRect();
        this.mouse.canvasX = touch.clientX - rect.left;
        this.mouse.canvasY = touch.clientY - rect.top;
      }
    };

    this.touchendListener = () => {
      this.mouse.isDown = false;
    };
  }

  public attach(element: HTMLElement): void {
    this.targetElement = element;
    window.addEventListener("keydown", this.keydownListener);
    window.addEventListener("keyup", this.keyupListener);
    element.addEventListener("mousemove", this.mousemoveListener);
    element.addEventListener("mousedown", this.mousedownListener);
    window.addEventListener("mouseup", this.mouseupListener);
    element.addEventListener("touchstart", this.touchstartListener);
    element.addEventListener("touchmove", this.touchmoveListener);
    window.addEventListener("touchend", this.touchendListener);
  }

  public detach(): void {
    window.removeEventListener("keydown", this.keydownListener);
    window.removeEventListener("keyup", this.keyupListener);
    if (this.targetElement) {
      this.targetElement.removeEventListener("mousemove", this.mousemoveListener);
      this.targetElement.removeEventListener("mousedown", this.mousedownListener);
      this.targetElement.removeEventListener("touchstart", this.touchstartListener);
      this.targetElement.removeEventListener("touchmove", this.touchmoveListener);
    }
    window.removeEventListener("mouseup", this.mouseupListener);
    window.removeEventListener("touchend", this.touchendListener);
    this.keys.clear();
    this.keysJustPressed.clear();
  }

  public isKeyDown(keyOrCode: string): boolean {
    const k = keyOrCode.toLowerCase();
    return !!(this.keys.get(k) || this.keys.get(`key${k}`));
  }

  public isKeyJustPressed(keyOrCode: string): boolean {
    const k = keyOrCode.toLowerCase();
    const pressed = !!(this.keysJustPressed.get(k) || this.keysJustPressed.get(`key${k}`));
    if (pressed) {
      this.keysJustPressed.set(k, false);
      this.keysJustPressed.set(`key${k}`, false);
    }
    return pressed;
  }

  public resetPerFrameInputs(): void {
    this.mouse.justClicked = false;
    this.keysJustPressed.clear();
  }

  // Calculate angle between target point (e.g. player) and mouse cursor
  public getAngleFrom(originX: number, originY: number): number {
    return Math.atan2(this.mouse.canvasY - originY, this.mouse.canvasX - originX);
  }
}
