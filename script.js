const setCurrentYear = () => {
    const year = String(new Date().getFullYear());
    document.querySelectorAll('[data-current-year]').forEach((element) => {
        element.textContent = year;
    });
};

const CALENDAR_TIMEOUT_MS = 10000;
const CONTRIBUTION_YEAR = '2026';
const CALENDAR_MONTH_SHORT = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' });
const CALENDAR_MONTH_LONG = new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' });

const withTimeout = (promise, timeoutMs) => {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error('Calendar request timed out')), timeoutMs);
    });

    return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
};

const waitForGitHubCalendarLibrary = () => new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const checkAvailability = () => {
        if (typeof window.GitHubCalendar === 'function') {
            resolve();
            return;
        }

        if (Date.now() - startedAt >= CALENDAR_TIMEOUT_MS) {
            reject(new Error('Calendar library failed to load'));
            return;
        }

        window.setTimeout(checkAvailability, 100);
    };

    checkAvailability();
});

const trimCalendarToYear = (calendar, year) => {
    const table = calendar.querySelector('table.ContributionCalendar-grid');
    const days = Array.from(calendar.querySelectorAll('.ContributionCalendar-day[data-date][data-ix]'));
    const yearDays = days.filter((day) => day.dataset.date.startsWith(`${year}-`));

    if (!table || !yearDays.length) {
        throw new Error(`No GitHub contribution data found for ${year}`);
    }

    const weekIndexes = yearDays.map((day) => Number(day.dataset.ix));
    const firstWeek = Math.min(...weekIndexes);
    const lastWeek = Math.max(...weekIndexes);
    const daysByWeek = new Map();

    yearDays.forEach((day) => {
        const week = Number(day.dataset.ix);
        const dates = daysByWeek.get(week) || [];
        dates.push(day.dataset.date);
        daysByWeek.set(week, dates);
    });

    days.forEach((day) => {
        const week = Number(day.dataset.ix);
        const tooltip = calendar.querySelector(`tool-tip[for="${day.id}"]`);

        if (week < firstWeek || week > lastWeek) {
            tooltip?.remove();
            day.remove();
            return;
        }

        if (!day.dataset.date.startsWith(`${year}-`)) {
            tooltip?.remove();
            day.classList.add('is-outside-year');
            day.setAttribute('aria-hidden', 'true');
            day.removeAttribute('aria-describedby');
            day.removeAttribute('aria-selected');
            day.removeAttribute('data-date');
            day.removeAttribute('data-ix');
            day.removeAttribute('data-level');
            day.removeAttribute('data-view-component');
            day.removeAttribute('id');
            day.removeAttribute('role');
            day.removeAttribute('tabindex');
        }
    });

    const headerRow = document.createElement('tr');
    headerRow.className = 'calendar-year-header';

    const dayHeading = document.createElement('td');
    dayHeading.className = 'calendar-day-heading';
    dayHeading.innerHTML = '<span class="sr-only">Day of week</span>';
    headerRow.appendChild(dayHeading);

    for (let week = firstWeek; week <= lastWeek; week += 1) {
        const monthHeading = document.createElement('td');
        monthHeading.className = 'ContributionCalendar-label calendar-month-label';
        const dates = (daysByWeek.get(week) || []).sort();
        const monthStart = dates.find((date) => date.endsWith('-01'));
        const labelDate = week === firstWeek ? dates[0] : monthStart;

        if (labelDate) {
            const date = new Date(`${labelDate}T00:00:00Z`);
            const accessibleLabel = document.createElement('span');
            const visualLabel = document.createElement('span');
            accessibleLabel.className = 'sr-only';
            accessibleLabel.textContent = CALENDAR_MONTH_LONG.format(date);
            visualLabel.setAttribute('aria-hidden', 'true');
            visualLabel.textContent = CALENDAR_MONTH_SHORT.format(date);
            monthHeading.append(accessibleLabel, visualLabel);
        }

        headerRow.appendChild(monthHeading);
    }

    const tableHead = table.tHead || table.createTHead();
    tableHead.replaceChildren(headerRow);
    table.setAttribute('aria-label', `GitHub contributions in ${year}`);
    const caption = table.querySelector('caption');
    if (caption) caption.textContent = `${year} contribution graph`;
};

const updateContributionTotal = (calendar, year) => {
    const summary = document.querySelector('[data-contribution-total]');
    if (!summary) return;

    const total = Array.from(calendar.querySelectorAll('tool-tip[for]')).reduce((sum, tooltip) => {
        const day = document.getElementById(tooltip.getAttribute('for'));
        const count = tooltip.textContent.trim().match(/^(\d+) contributions?/);

        if (!day?.dataset.date?.startsWith(year) || !count) return sum;
        return sum + Number(count[1]);
    }, 0);

    summary.textContent = total > 0
        ? `${total.toLocaleString()} public contributions in ${year}. Activity, not achievement.`
        : `Public GitHub contribution activity in ${year}.`;
};

const showCalendarError = (calendar) => {
    calendar.innerHTML = `
        <p class="calendar-error">
            GitHub activity is temporarily unavailable.
            <a href="https://github.com/AryanBhargavprojects" target="_blank" rel="noreferrer" aria-label="View AryanBhargavprojects on GitHub (opens in a new tab)">View the profile directly</a>.
        </p>
    `;
};

const loadGitHubCalendar = async () => {
    const calendar = document.querySelector('[data-github-calendar]');

    if (!calendar) return;

    try {
        await waitForGitHubCalendarLibrary();
        await withTimeout(window.GitHubCalendar(calendar, 'AryanBhargavprojects', {
            responsive: true,
            tooltips: true,
            global_stats: false,
            cache: 86400,
            summary_text: 'Public GitHub contributions by Aryan Bhargav'
        }), CALENDAR_TIMEOUT_MS);
        trimCalendarToYear(calendar, CONTRIBUTION_YEAR);
        updateContributionTotal(calendar, CONTRIBUTION_YEAR);
        calendar.classList.add('is-ready');
    } catch (error) {
        console.error('Unable to load GitHub contribution calendar:', error);
        showCalendarError(calendar);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setCurrentYear();
    loadGitHubCalendar();
});
