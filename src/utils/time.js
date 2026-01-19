export function getCurrentDate() {
    return formatDateToLocal(new Date());
}

export function formatDateToLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
}

export function getTimeUntilMidnight() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);

    const diff = midnight - now;
    if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, total: 0 };

    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    return { hours, minutes, seconds, total: diff };
}

export function onDateChange(callback) {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);

    const timeToMidnight = midnight - now;

    // Set timeout to fire at midnight (+ small buffer)
    setTimeout(() => {
        callback();
        // Re-register for next day
        onDateChange(callback);
    }, timeToMidnight + 1000);
}
