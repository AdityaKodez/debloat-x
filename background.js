const readEnabled = async () => {
  const { enabled } = await chrome.storage.local.get({ enabled: true });
  return enabled !== false;
};

const showState = async (enabled) => {
  await Promise.all([
    chrome.action.setBadgeText({ text: enabled ? "" : "off" }),
    chrome.action.setBadgeBackgroundColor({ color: "#536471" }),
    chrome.action.setTitle({
      title: enabled ? "Debloat X: on (click to turn off)" : "Debloat X: off (click to turn on)",
    }),
  ]);
};

const syncState = async () => showState(await readEnabled());

chrome.runtime.onInstalled.addListener(syncState);
chrome.runtime.onStartup.addListener(syncState);

chrome.action.onClicked.addListener(async () => {
  const enabled = !(await readEnabled());
  await chrome.storage.local.set({ enabled });
  await showState(enabled);
});
