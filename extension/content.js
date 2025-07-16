function loadWidget(data) {
    const container = document.createElement('div');
    container.id = 'payday-widget';
    container.innerHTML = '<span id="widget-status"></span><span id="show-config">⚙</span>'
    document.body.appendChild(container);
    const statusBar = document.getElementById('widget-status')

    document.getElementById('show-config').onclick = () => {
        container.remove()
        showConfigForm(data)
    }

    container.onclick = () => {
        container.style.display = 'none';
    }

    const [fromHour, fromMinute] = data.startTime.split(':').map(Number);
    const [toHour, toMinute] = data.endTime.split(':').map(Number);

    const totalWorkSeconds = calculateWorkingSeconds(fromHour, fromMinute, toHour, toMinute);
    const salaryPerSec = calculateSecondlySalary(parseFloat(data.yearly), totalWorkSeconds);
    const currency = data.currency;

    function updateEarnings() {
        const now = new Date();
        const start = new Date();
        const end = new Date();
        start.setHours(fromHour, fromMinute, 0, 0);
        end.setHours(toHour, toMinute, 0, 0);

        // TODO well, we ignore weekend at the moment
        if (now < start || now > end) {
            container.style.display = 'none'; // hide outside work hours
            return;
        }

        container.style.display = 'block';

        const elapsedSeconds = Math.floor((now - start) / 1000);
        const earned = elapsedSeconds * salaryPerSec;
        statusBar.textContent = `${earned.toFixed(2)} ${currency} earned today`;
    }

    updateEarnings();
    setInterval(updateEarnings, 1000);
}

function showConfigForm(storedConfig = {}) {
    const div = document.createElement('div');
    div.id = 'payday-widget';

    const { yearly = '', currency = '€', startTime = '08:00', endTime = '17:00' } = storedConfig;

    div.innerHTML = `
    <label>Yearly Salary</label>
    <input id="salary" type="number" placeholder="e.g. 30000" value="${yearly}"/>
    <label>Currency</label>
    <input id="currency" type="text" placeholder="e.g. €" value="${currency}" maxlength="5" />
    <label>Work starts at</label>
    <input id="startTime" type="time" value="${startTime}"/>
    <label>Work ends at</label>
    <input id="endTime" type="time" value="${endTime}"/>
    <button id="saveBtn">Save</button>
  `;

    document.body.appendChild(div);

    document.getElementById('saveBtn').onclick = () => {
        const yearly = document.getElementById('salary').value;
        const currency = document.getElementById('currency').value;
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;

        if (yearly && currency && startTime && endTime) {
            const data = { yearly, currency, startTime, endTime };
            chrome.storage.local.set({ paydayData: data }, () => {
                div.remove();
                loadWidget(data);
            });
        }
    };
}

function calculateWorkingSeconds(fromH, fromM, toH, toM) {
    return ((toH * 60 + toM) - (fromH * 60 + fromM)) * 60;
}

function calculateSecondlySalary(yearly, totalWorkSeconds) {
    const daily = (yearly / 12) / 22;
    return daily / totalWorkSeconds;
}

// INIT
chrome.storage.local.get('paydayData', (res) => {
    if (res.paydayData) {
        loadWidget(res.paydayData);
    } else {
        showConfigForm();
    }
});
