/**
 * Helpers for the ScriptSelect listbox that replaced the native <select>s.
 * Option indexes here match the old selectOption({ index }) numbering, where
 * index 0 was the "Which Film?" / "Who Said It?" placeholder option.
 */

export async function openScriptSelect(page, testId) {
    await page.getByTestId(testId).click();
    await page.locator(`#${testId}-listbox`).waitFor({ state: 'visible' });
}

export async function selectScriptOption(page, testId, index) {
    await openScriptSelect(page, testId);
    await page.locator(`#${testId}-opt-${index - 1}`).click();
    await page.locator(`#${testId}-listbox`).waitFor({ state: 'hidden' });
}
