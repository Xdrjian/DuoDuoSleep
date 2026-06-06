// --- 数据初始化 ---
let currentViewDate = new Date(); // 用于记录当前日历正在浏览哪个月份
let viewYear = currentViewDate.getFullYear();
let viewMonth = currentViewDate.getMonth(); // 
let branches = parseInt(localStorage.getItem('dd_branches')) || 0;
let isSick = localStorage.getItem('dd_isSick') === 'true';
let isDead = localStorage.getItem('dd_isDead') === 'true';
let consecutiveLateDays = parseInt(localStorage.getItem('dd_consecutiveLateDays')) || 0;
let consecutiveOnTimeDays = parseInt(localStorage.getItem('dd_consecutiveOnTimeDays')) || 0;
let appState = localStorage.getItem('dd_appState') || 'awake'; // 'awake' 或 'sleeping'
let historyObj = JSON.parse(localStorage.getItem('dd_history')) || {}; 

const sleepBtn = document.getElementById('sleepBtn');
const wakeBtn = document.getElementById('wakeBtn');
const img = document.getElementById('duoduoImg');
const bubble = document.getElementById('speechBubble');

initUI();
setInterval(checkTimeRoutine, 60000); // 每分钟检查一次时间

// --- 核心时间逻辑 ---
// 定义系统的“逻辑日期”：凌晨4点前算作“昨天”
function getLogicalDate() {
    let d = new Date();
    if (d.getHours() < 4) d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function checkTimeRoutine() {
    if (isDead) return;
    if (appState === 'sleeping') return;

    let d = new Date();
    let h = d.getHours();
    let m = d.getMinutes();

    if (isSick) {
        setDuoduoState('sick', '主人，我浑身没力气...我们需要连续按时睡三天才能恢复。');
        return;
    }

    // 状态切换判定
    if (h === 23 && m >= 0 && m < 30) {
        setDuoduoState('sleepy', '打哈欠~ 困了困了，该睡觉了！');
        playSound('audioYawn');
    } else if (h === 23 && m >= 30 && m < 50) {
        setDuoduoState('anxious', '多多快撑不住了，要栽头了...');
        playSound('audioWhine');
    } else if (h === 23 && m >= 50 || h < 4) {
        setDuoduoState('anxious', '已经过了睡觉时间了！痛苦！');
    } else {
        setDuoduoState('normal', '无论如何，要晚上23:50前睡觉哦！');
    }
}

// --- 交互动作 ---
sleepBtn.addEventListener('click', () => {
    if (isDead) return;
    let d = new Date();
    let h = d.getHours();
    let m = d.getMinutes();
    let logicalDate = getLogicalDate();

    // 判定是否熬夜 (23:50 之后算熬夜，包括凌晨 0-3点)
    let isLate = false;
    if ((h === 23 && m >= 50) || h < 4) {
        isLate = true;
    }

    historyObj[logicalDate] = isLate ? 'late' : 'onTime';
    
    if (isLate) {
        consecutiveLateDays++;
        consecutiveOnTimeDays = 0;
        isSick = true;
        playSound('audioSad');
        showToast("💔 超过23:50！多多健康受损...");
        if (consecutiveLateDays >= 3) {
            isDead = true;
            showToast("多多永远地离开了你...");
        }
    } else {
        consecutiveLateDays = 0;
        consecutiveOnTimeDays++;
        if (isSick && consecutiveOnTimeDays >= 3) {
            isSick = false; // 治愈
            showToast("✨ 连续3天按时入睡，多多恢复健康了！");
        } else if (!isSick) {
            showToast("💤 睡了睡了");
        } else {
            showToast(`💤 疗愈中...还需要坚持 ${3 - consecutiveOnTimeDays} 天按时入睡。`);
        }
    }

    appState = 'sleeping';
    saveData();
    initUI();
    document.getElementById('audioSleep').play().catch(()=>{});
});

wakeBtn.addEventListener('click', () => {
    let d = new Date();
    if (d.getHours() < 8) {
        showToast("天还没大亮呢，8:00 之后再叫醒多多吧！");
        return;
    }

    document.getElementById('audioSleep').pause();
    appState = 'awake';
    
    // 结算奖励：如果不生病，且昨晚没熬夜
    let yesterday = getLogicalDate(); // 早上醒来时，逻辑日期已经是新的一天，但我们需要判定的是昨晚的记录
    let d2 = new Date(); d2.setDate(d2.getDate() - 1);
    let checkDate = `${d2.getFullYear()}-${String(d2.getMonth()+1).padStart(2,'0')}-${String(d2.getDate()).padStart(2,'0')}`;

    if (!isSick && historyObj[checkDate] === 'onTime') {
        let reward = Math.floor(Math.random() * 3) + 1;
        branches += reward;
        setDuoduoState('reward', `早安主人！我捡到了 ${reward} 根树枝！`);
        playSound('audioBark');
    } else {
        setDuoduoState(isSick ? 'sick' : 'normal', '早安...今天晚上一定要乖乖睡觉哦。');
    }

    saveData();
    initUI();
});

// --- UI与数据挂载 ---
function initUI() {
    document.getElementById('branchDisplay').innerText = branches;
    document.getElementById('progressFill').style.width = Math.min((branches/100)*100, 100) + '%';
    
    // 【新增】更新主界面的连胜天数
    document.getElementById('streakDisplay').innerText = consecutiveOnTimeDays;
    
    renderCalendar();

    if (isDead) {
        setDuoduoState('dead', '多多已经离开了这座森林，再也回不来了。');
        sleepBtn.style.display = 'none';
        wakeBtn.style.display = 'none';
        return;
    }

    if (appState === 'sleeping') {
        setDuoduoState('sleeping', 'Zzz...');
        sleepBtn.style.display = 'none';
        wakeBtn.style.display = 'block';
    } else {
        sleepBtn.style.display = 'block';
        wakeBtn.style.display = 'none';
        checkTimeRoutine();
    }
}

function setDuoduoState(imgName, text) {
    img.src = `assets/images/${imgName}.png`;
    bubble.innerText = text;
}

function saveData() {
    localStorage.setItem('dd_branches', branches);
    localStorage.setItem('dd_isSick', isSick);
    localStorage.setItem('dd_isDead', isDead);
    localStorage.setItem('dd_consecutiveLateDays', consecutiveLateDays);
    localStorage.setItem('dd_consecutiveOnTimeDays', consecutiveOnTimeDays);
    localStorage.setItem('dd_appState', appState);
    localStorage.setItem('dd_history', JSON.stringify(historyObj));
}

function initUI() {
    document.getElementById('branchDisplay').innerText = branches;
    document.getElementById('progressFill').style.width = Math.min((branches/100)*100, 100) + '%';
    
    // 【新增】更新主界面的连胜天数
    document.getElementById('streakDisplay').innerText = consecutiveOnTimeDays;
    
    renderCalendar();

    if (isDead) {
        setDuoduoState('dead', '多多已经离开了这座森林，再也回不来了。');
        sleepBtn.style.display = 'none';
        wakeBtn.style.display = 'none';
        return;
    }

    if (appState === 'sleeping') {
        setDuoduoState('sleeping', 'Zzz...');
        sleepBtn.style.display = 'none';
        wakeBtn.style.display = 'block';
    } else {
        sleepBtn.style.display = 'block';
        wakeBtn.style.display = 'none';
        checkTimeRoutine();
    }
}

// 【全新升级】支持任意月份翻页和正确星期对齐的日历生成器
function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const title = document.getElementById('calendarTitle');
    grid.innerHTML = '';
    
    // 更新标题，例如：2026年06月
    title.innerText = `${viewYear}年${String(viewMonth + 1).padStart(2, '0')}月`;

    // 获取该月第一天是星期几 (0:周日, 1:周一...6:周六)
    let firstDay = new Date(viewYear, viewMonth, 1).getDay();
    // 获取该月总天数
    let daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    // 格式化当前月份前缀，用于比对历史数据，例如 "2026-06-"
    let monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-`;

    // 1. 填充第一天前面的空白格子，确保星期几对齐
    for (let i = 0; i < firstDay; i++) {
        let blankCell = document.createElement('div');
        grid.appendChild(blankCell);
    }

    // 2. 渲染实际的日期格子
    for(let i = 1; i <= daysInMonth; i++) {
        let dateStr = monthPrefix + String(i).padStart(2, '0');
        let cell = document.createElement('div');
        cell.className = 'day-cell';
        cell.innerText = i;
        
        // 匹配历史记录颜色
        if (historyObj[dateStr] === 'onTime') cell.classList.add('day-on-time');
        else if (historyObj[dateStr] === 'late') cell.classList.add('day-late');
        
        grid.appendChild(cell);
    }
}

// 【新增】日历翻页按钮绑定逻辑
document.getElementById('prevMonthBtn').addEventListener('click', () => {
    viewMonth--;
    if(viewMonth < 0) {
        viewMonth = 11;
        viewYear--;
    }
    renderCalendar();
});

document.getElementById('nextMonthBtn').addEventListener('click', () => {
    viewMonth++;
    if(viewMonth > 11) {
        viewMonth = 0;
        viewYear++;
    }
    renderCalendar();
});

function showToast(msg) {
    let t = document.createElement('div'); t.className = 'toast'; t.innerText = msg;
    document.getElementById('toastContainer').appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function playSound(id) {
    let a = document.getElementById(id);
    if(a) { a.currentTime = 0; a.play().catch(()=>{}); }
}
// 注册 Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
}
