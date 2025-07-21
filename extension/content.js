class PaydayConfig {
    constructor({
                    yearly = '',
                    currency = '€',
                    startTime = '08:00',
                    endTime = '17:00',
                    isMinimized = false,
                } = {}
    ) {
        this.yearly = yearly;
        this.currency = currency;
        this.startTime = startTime;
        this.endTime = endTime;
        this.isMinimized = isMinimized;
        this.isDefault = true;
    }

    save() {
        const paydayData = {
            yearly: this.yearly,
            currency: this.currency,
            startTime: this.startTime,
            endTime: this.endTime,
            minimized: this.isMinimized
        };

        return chrome.storage.local.set({paydayData});
    }

    static async load() {
        const data = await new Promise((resolve) => {
            chrome.storage.local.get('paydayData', (result) => resolve(result));
        });

        const persistedConfig = data.paydayData ?? {};
        const result = new PaydayConfig(persistedConfig);
        result.isDefault = !persistedConfig.hasOwnProperty('yearly');

        return result;
    }

    isValid() {
        return this.yearly && this.currency && this.startTime && this.endTime;
    }
}

class Tracker {
    constructor(config) {
        this.config = config;
        const [fromH, fromM] = config.startTime.split(':').map(Number);
        const [toH, toM] = config.endTime.split(':').map(Number);

        this.fromHour = fromH;
        this.fromMinute = fromM;
        this.toHour = toH;
        this.toMinute = toM;
        this.totalWorkSeconds = this.#calculateWorkingSeconds();
        this.salaryPerSecond = this.#calculateSecondlySalary();
    }

    #calculateWorkingSeconds() {
        return ((this.toHour * 60 + this.toMinute) - (this.fromHour * 60 + this.fromMinute)) * 60;
    }

    #calculateSecondlySalary() {
        const daily = (parseFloat(this.config.yearly) / 12) / 22;
        return daily / this.totalWorkSeconds;
    }

    isWorkdayEnded(now = new Date()) {
        const start = new Date();
        const end = new Date();
        start.setHours(this.fromHour, this.fromMinute, 0, 0);
        end.setHours(this.toHour, this.toMinute, 0, 0);
        return now < start || now > end;
    }

    earnedToday(now = new Date()) {
        const start = new Date();
        start.setHours(this.fromHour, this.fromMinute, 0, 0);
        const elapsedSeconds = Math.floor((now - start) / 1000);
        return elapsedSeconds * this.salaryPerSecond;
    }
}

class Widget {
    constructor(config) {
        this.config = config;
        this.calculator = new Tracker(config);
        this.minimized = false;
        this.isAutoMinimized = false;

        this.#createWidget();
        this.#updateEarnings();
        this.interval = setInterval(() => this.#updateEarnings(), 1000);
    }

    getDOMElement = () => this.container

    #createWidget() {
        this.container = document.createElement('div');
        this.container.id = 'payday-widget';

        this.statusBar = document.createElement('span');
        this.statusBar.id = 'widget-status';

        this.configBar = document.createElement('span');
        this.configBar.id = 'show-config'
        this.configBar.innerText = '⚙';

        this.configBar.onclick = () => {
            clearInterval(this.interval);
            this.container.remove();
            renderWidget(new PaydayUI(this.config))
        };

        this.container.appendChild(this.statusBar);
        this.container.appendChild(this.configBar);

        this.container.onclick = () => {
            this.minimized = !this.minimized;
            this.config.isMinimized = this.minimized;
            this.#updateEarnings();
            this.config.save()
        };
    }

    #updateEarnings() {
        const workdayInProgress = !this.calculator.isWorkdayEnded();
        if (workdayInProgress && this.isAutoMinimized) {
            this.show();
            this.isAutoMinimized = false;
        }

        if (this.minimized) {
            if (this.statusBar.textContent !== 'PD') {
                this.statusBar.textContent = 'PD';
            }

            return;
        }

        if (!workdayInProgress) {
            if (!this.isAutoMinimized) {
                this.isAutoMinimized = true;
                this.hide()
            }
            return;
        }

        const earned = this.calculator.earnedToday();
        this.statusBar.textContent = `${earned.toFixed(2)} ${this.config.currency} earned today`;
    }

    hide = () => this.minimized = true;
    show = () => this.minimized = false;
}

class PaydayUI {
    constructor(config) {
        this.config = config
        this.container = document.createElement('div');

        this.#createWidget()
    }

    getDOMElement = () => this.container

    #createWidget() {
        const config = this.config;

        this.container.id = 'payday-widget';

        this.container.innerHTML = `
          <label for="salary">Yearly Salary</label>
          <input id="salary" type="number" placeholder="e.g. 30000" value="${config.yearly}"/>
          <label for="currency">Currency</label>
          <input id="currency" type="text" placeholder="e.g. €" value="${config.currency}" maxlength="5"/>
          <label for="startTime">Work starts at</label>
          <input id="startTime" type="time" value="${config.startTime}"/>
          <label for="endTime">Work ends at</label>
          <input id="endTime" type="time" value="${config.endTime}"/>
        `;

        const saveBtn = document.createElement('button');
        saveBtn.id = 'saveBtn';
        saveBtn.innerText = 'Save';
        saveBtn.onclick = () => {
            const newConfig = new PaydayConfig({
                yearly: document.getElementById('salary').value,
                currency: document.getElementById('currency').value,
                startTime: document.getElementById('startTime').value,
                endTime: document.getElementById('endTime').value,
            });

            if (!newConfig.isValid()) {
                saveBtn.style.borderColor = "#a00";

                return;
            }

            newConfig
                .save()
                .then(() => {
                    this.container.remove();
                    renderWidget(new Widget(newConfig));
                });
        };


        this.container.appendChild(saveBtn)
    }
}

const draggable = (widget) => {
    widget.style.cursor = 'grab';
    // Drag and drop
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    widget.onmousedown = (e) => {
        e.stopPropagation();
        isDragging = true;
        offsetX = e.clientX - widget.offsetLeft;
        offsetY = e.clientY - widget.offsetTop;
        widget.style.cursor = 'grabbing';
    };

    // I'm not experienced enough to make overlap prevention adequate.
    // This way I ensure that there is only one global handler for mouse movement on document.
    document.onmousemove = (e) => {
        if (!isDragging) return;
        widget.style.left = (e.clientX - offsetX) + 'px';
        widget.style.top = (e.clientY - offsetY) + 'px';
        widget.style.right = widget.style.bottom = 'unset';
    };

    document.onmouseup = () => {
        isDragging = false;
        widget.style.cursor = 'grab';
    };

    return widget
}

const renderWidget = (widget) => document.body.appendChild(draggable(widget.getDOMElement()))

PaydayConfig
    .load()
    .then((config) => {
        renderWidget(config.isDefault ? new PaydayUI(config) : new Widget(config));
    });