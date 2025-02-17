class GamepadManager {
    constructor() {
        this.gamepads = {};
        this.onGamepadConnected = null;
        this.onGamepadDisconnected = null;
        this.init();
    }

    init() {
        window.addEventListener('gamepadconnected', (e) => {
            this.gamepads[e.gamepad.index] = e.gamepad;
            if (this.onGamepadConnected) {
                this.onGamepadConnected(e.gamepad);
            }
        });

        window.addEventListener('gamepaddisconnected', (e) => {
            delete this.gamepads[e.gamepad.index];
            if (this.onGamepadDisconnected) {
                this.onGamepadDisconnected(e.gamepad);
            }
        });
    }

    getGamepad(index = 0) {
        return navigator.getGamepads()[index];
    }

    getAllGamepads() {
        return navigator.getGamepads();
    }
}