/**
 * The content script, injected only when the user clicks the toolbar button.
 *
 * The manifest declares no `content_scripts`, so nothing here runs on any page
 * until that click: the popup calls chrome.scripting.executeScript against the
 * activeTab. It reads the DOM that is already rendered and fetches nothing.
 *
 * The one thing it does change is opening collapsed "…more" sections first —
 * boards keep the ad body out of the DOM until that control is clicked, so
 * reading without expanding captures the page furniture instead of the job.
 */
import { extractFromPage } from "./adapters";
import { expandCollapsedSections } from "./expand";

declare const chrome: {
  runtime: { sendMessage: (msg: unknown) => void };
};

async function run() {
  const expanded = await expandCollapsedSections(document);
  chrome.runtime.sendMessage({
    type: "jobtracker:extracted",
    payload: { ...extractFromPage(document, location.href), expanded },
  });
}

void run().catch((error: unknown) => {
  chrome.runtime.sendMessage({
    type: "jobtracker:error",
    message: error instanceof Error ? error.message : "Could not read this page",
  });
});
