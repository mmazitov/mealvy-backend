export function formatDateToISO(date: Date | string): string {
	if (typeof date === 'string') {
		return date;
	}
	return date.toISOString().split('T')[0];
}

export function formatDateOrKeep(date: Date | string | undefined): string | undefined {
	if (!date) return undefined;
	return formatDateToISO(date);
}
