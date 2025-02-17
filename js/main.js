const gamepadManager = new GamepadManager();
const connectionStatus = document.getElementById('connection-status');
let currentDeadzone = 0.10; // 默认死区值

// 存储上一次的摇杆值，用于计算回报率
let lastAxesValues = {
    left: {
        x: { value: 0, timestamp: 0, samples: [] },
        y: { value: 0, timestamp: 0, samples: [] }
    },
    right: {
        x: { value: 0, timestamp: 0, samples: [] },
        y: { value: 0, timestamp: 0, samples: [] }
    }
};

// 存储方向键组合
let currentDpadCombo = new Set();

// 添加按键计数对象
const dpadCounts = {
    up: 0,
    right: 0,
    down: 0,
    left: 0
};

// 添加按键状态跟踪对象
const dpadStates = {
    up: false,
    right: false,
    down: false,
    left: false
};

// 在文件开头添加重置按钮的引用
const resetButton = document.getElementById('reset-dpad-count');

// 初始化死区滑块
const deadzoneSlider = document.getElementById('deadzoneSlider');
const deadzoneValue = document.getElementById('deadzoneValue');
if (deadzoneSlider) {
    deadzoneSlider.addEventListener('input', (e) => {
        currentDeadzone = parseFloat(e.target.value);
        deadzoneValue.textContent = currentDeadzone.toFixed(2);
    });
}

// 在初始化部分添加重置按钮的事件监听
if (resetButton) {
    resetButton.addEventListener('click', resetDpadCounts);
}

// 更新连接状态显示
gamepadManager.onGamepadConnected = (gamepad) => {
    connectionStatus.textContent = `已连接: ${gamepad.id}`;
    connectionStatus.style.backgroundColor = '#E8F5E9';
    startGamepadLoop();
    setupVibrationControls(gamepad);
};

gamepadManager.onGamepadDisconnected = (gamepad) => {
    connectionStatus.textContent = '未检测到手柄';
    connectionStatus.style.backgroundColor = '#FFEBEE';
};

// 主循环
function startGamepadLoop() {
    let lastTimestamp = performance.now();
    
    function updateStatus() {
        const gamepad = gamepadManager.getGamepad();
        if (gamepad) {
            const currentTimestamp = performance.now();
            updateButtons(gamepad);
            updateJoysticks(gamepad, currentTimestamp);
            updateTriggers(gamepad);
            updateDpad(gamepad);
            lastTimestamp = currentTimestamp;
        }
        requestAnimationFrame(updateStatus);
    }
    updateStatus();
}

// 更新按键状态
function updateButtons(gamepad) {
    const buttons = document.querySelectorAll('.gamepad-button');
    buttons.forEach(button => {
        const index = parseInt(button.dataset.button);
        const gamepadButton = gamepad.buttons[index];
        
        if (gamepadButton && gamepadButton.pressed) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}

// 更新摇杆显示和回报率
function updateJoysticks(gamepad, timestamp) {
    // 回报率测试
    updateJoystickPolling(gamepad, timestamp);
    // 死区测试
    updateJoystickDeadzone(gamepad);
}

// 采样窗口大小（毫秒）
const SAMPLE_WINDOW = 1000;
// 最小变化阈值，过滤抖动
const MOVEMENT_THRESHOLD = 0.01;

function calculateAxesDelta(newX, newY, axisData, timestamp) {
    // 分别计算X和Y轴的回报率
    const xRate = calculateAxisRate(newX, axisData.x, timestamp);
    const yRate = calculateAxisRate(newY, axisData.y, timestamp);

    // 返回较高的回报率
    return Math.max(xRate, yRate);
}

function calculateAxisRate(newValue, axisData, timestamp) {
    const timeDelta = timestamp - axisData.timestamp;
    
    // 如果变化大于阈值，记录这次更新
    if (Math.abs(newValue - axisData.value) > MOVEMENT_THRESHOLD) {
        // 添加新的采样点
        axisData.samples.push({
            timestamp: timestamp,
            value: newValue
        });

        // 只保留采样窗口内的数据
        const windowStart = timestamp - SAMPLE_WINDOW;
        axisData.samples = axisData.samples.filter(sample => sample.timestamp > windowStart);

        // 如果有足够的样本，计算回报率
        if (axisData.samples.length > 1) {
            const totalTime = axisData.samples[axisData.samples.length - 1].timestamp - 
                            axisData.samples[0].timestamp;
            const updateCount = axisData.samples.length - 1;
            
            // 计算平均回报率（每秒更新次数）
            const rate = Math.round((updateCount / totalTime) * 1000);
            
            // 更新数据
            axisData.value = newValue;
            axisData.timestamp = timestamp;
            
            return rate;
        }
    }

    return null;
}

function updateJoystickPolling(gamepad, timestamp) {
    // 左摇杆
    const leftRate = calculateAxesDelta(
        gamepad.axes[0],
        gamepad.axes[1],
        lastAxesValues.left,
        timestamp
    );
    updateJoystickCanvas('leftStickPolling', gamepad.axes[0], gamepad.axes[1]);
    updatePollingRateDisplay('leftStickRate', leftRate);

    // 右摇杆
    const rightRate = calculateAxesDelta(
        gamepad.axes[2],
        gamepad.axes[3],
        lastAxesValues.right,
        timestamp
    );
    updateJoystickCanvas('rightStickPolling', gamepad.axes[2], gamepad.axes[3]);
    updatePollingRateDisplay('rightStickRate', rightRate);
}

function updatePollingRateDisplay(elementId, rate) {
    const element = document.getElementById(elementId);
    if (element && rate !== null) {
        // 添加最大值显示
        const currentMax = parseInt(element.dataset.maxRate || '0');
        const newMax = Math.max(currentMax, rate);
        element.dataset.maxRate = newMax;
        
        element.innerHTML = `当前: ${rate}Hz<br>最大: ${newMax}Hz`;
    }
}

function updateJoystickDeadzone(gamepad) {
    // 左摇杆
    updateDeadzoneCanvas('leftStickDeadzone', gamepad.axes[0], gamepad.axes[1]);
    updateStickPosition('leftStickPos', gamepad.axes[0], gamepad.axes[1]);

    // 右摇杆
    updateDeadzoneCanvas('rightStickDeadzone', gamepad.axes[2], gamepad.axes[3]);
    updateStickPosition('rightStickPos', gamepad.axes[2], gamepad.axes[3]);
}

function updateJoystickCanvas(canvasId, x, y) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 80;

    // 绘制背景圆
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#ccc';
    ctx.stroke();

    // 绘制十字准线
    ctx.beginPath();
    ctx.moveTo(centerX - radius, centerY);
    ctx.lineTo(centerX + radius, centerY);
    ctx.moveTo(centerX, centerY - radius);
    ctx.lineTo(centerX, centerY + radius);
    ctx.strokeStyle = 'rgba(0, 122, 255, 0.2)';
    ctx.stroke();

    // 绘制摇杆位置
    const stickX = centerX + (x * radius);
    const stickY = centerY + (y * radius);
    
    ctx.beginPath();
    ctx.arc(stickX, stickY, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#007AFF';
    ctx.fill();
}

function updateDeadzoneCanvas(canvasId, x, y) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 80;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制死区
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * currentDeadzone, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fill();

    // 绘制背景圆
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#ccc';
    ctx.stroke();

    // 绘制摇杆位置
    const stickX = centerX + (x * radius);
    const stickY = centerY + (y * radius);
    
    ctx.beginPath();
    ctx.arc(stickX, stickY, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#007AFF';
    ctx.fill();
}

function updateStickPosition(elementId, x, y) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = `X: ${x.toFixed(2)}, Y: ${y.toFixed(2)}`;
    }
}

// 更新方向键状态
function updateDpad(gamepad) {
    const dpadButtons = document.querySelectorAll('.dpad > div');
    currentDpadCombo.clear();
    
    // 更新方向键状态和计数
    updateDpadButton(gamepad.buttons[12], 'up');
    updateDpadButton(gamepad.buttons[15], 'right');
    updateDpadButton(gamepad.buttons[13], 'down');
    updateDpadButton(gamepad.buttons[14], 'left');

    // 更新UI显示
    dpadButtons.forEach(button => {
        const index = parseInt(button.dataset.button);
        if (gamepad.buttons[index] && gamepad.buttons[index].pressed) {
            button.classList.add('active');
            currentDpadCombo.add(button.textContent);
        } else {
            button.classList.remove('active');
        }
    });

    updateDpadComboDisplay();
}

// 更新单个方向键的状态和计数
function updateDpadButton(button, direction) {
    if (button && button.pressed) {
        if (!dpadStates[direction]) {  // 只在按键首次按下时计数
            dpadCounts[direction]++;
            updateDpadCount(direction);
            dpadStates[direction] = true;
        }
    } else {
        dpadStates[direction] = false;
    }
}

// 更新方向键计数显示
function updateDpadCount(direction) {
    const countElement = document.getElementById(`${direction}-count`);
    if (countElement) {
        countElement.textContent = dpadCounts[direction];
    }
}

function updateDpadComboDisplay() {
    const comboDisplay = document.getElementById('dpad-combo-display');
    if (comboDisplay) {
        if (currentDpadCombo.size > 0) {
            comboDisplay.textContent = Array.from(currentDpadCombo).join(' + ');
        } else {
            comboDisplay.textContent = '无';
        }
    }
}

// 更新扳机显示
function updateTriggers(gamepad) {
    const leftTrigger = document.querySelector('.trigger.left .trigger-bar');
    const rightTrigger = document.querySelector('.trigger.right .trigger-bar');
    const leftValue = document.querySelector('.trigger.left span');
    const rightValue = document.querySelector('.trigger.right span');

    if (leftTrigger && rightTrigger && leftValue && rightValue) {
        const l2 = Math.round(gamepad.buttons[6].value * 100);
        const r2 = Math.round(gamepad.buttons[7].value * 100);

        leftTrigger.style.height = `${l2}%`;
        rightTrigger.style.height = `${r2}%`;
        leftValue.textContent = `L2: ${l2}%`;
        rightValue.textContent = `R2: ${r2}%`;
    }
}

// 设置震动控制
function setupVibrationControls(gamepad) {
    const weakBtn = document.getElementById('weak-vibration');
    const strongBtn = document.getElementById('strong-vibration');

    if (weakBtn && strongBtn) {
        weakBtn.addEventListener('click', () => {
            if (gamepad.vibrationActuator) {
                gamepad.vibrationActuator.playEffect('dual-rumble', {
                    startDelay: 0,
                    duration: 1000,
                    weakMagnitude: 0.5,
                    strongMagnitude: 0
                });
            }
        });

        strongBtn.addEventListener('click', () => {
            if (gamepad.vibrationActuator) {
                gamepad.vibrationActuator.playEffect('dual-rumble', {
                    startDelay: 0,
                    duration: 1000,
                    weakMagnitude: 0,
                    strongMagnitude: 1.0
                });
            }
        });
    }
}

// 添加重置函数
function resetDpadCounts() {
    // 重置计数器
    Object.keys(dpadCounts).forEach(key => {
        dpadCounts[key] = 0;
    });
    
    // 重置状态
    Object.keys(dpadStates).forEach(key => {
        dpadStates[key] = false;
    });
    
    // 更新显示
    ['up', 'down', 'left', 'right'].forEach(direction => {
        updateDpadCount(direction);
    });
    
    // 清除当前组合显示
    currentDpadCombo.clear();
    updateDpadComboDisplay();
}