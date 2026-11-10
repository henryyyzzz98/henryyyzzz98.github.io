/**
 * Fansign Event Table — poster auto-fill (Google Apps Script backend).
 *
 * Paste this file into the SAME Apps Script project that already serves
 * fsindexer.html (Extensions → Apps Script → + → Script → "extractPoster").
 *
 * Setup (one time):
 *   1. Get an API key at https://platform.claude.com (Settings → API keys).
 *   2. In Apps Script: Project Settings (gear) → Script Properties →
 *      Add property  ANTHROPIC_API_KEY = sk-ant-...
 *      (The key stays on Google's server; it is never sent to visitors.)
 *   3. In your existing doPost(e) router, add a branch for the new action:
 *
 *        case "extractPoster":
 *          return json({ ok: true, events: extractPoster(body) });
 *
 *      (use whatever helper your script already uses to return
 *       ContentService JSON — the frontend expects { ok: true, events: [...] })
 *   4. Deploy → Manage deployments → Edit → New version → Deploy.
 *      The /exec URL stays the same, so fsindexer.html needs no change.
 */

var CLAUDE_MODEL = "claude-opus-5-5";

var EVENT_TYPES = ["대면팬싸", "단체영통", "개인영통"];

var MAX_IMAGES = 10;
var ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

var POSTER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["events"],
  properties: {
    events: {
      type: "array",
      description:
        "One entry per distinct fansign session on the poster (e.g. an in-person fansign and a video call fansign on different dates are two entries).",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "date",
          "time",
          "event",
          "organizer",
          "winners",
          "polaroid",
          "members",
          "notes",
        ],
        properties: {
          date: {
            type: "string",
            description: "Event date as YYYY-MM-DD, or empty string if not shown.",
          },
          time: {
            type: "string",
            description: "Event start time, 24h HH:MM (KST as printed), or empty string.",
          },
          event: {
            type: "string",
            enum: EVENT_TYPES.concat([""]),
            description:
              "대면팬싸 = in-person fansign, 단체영통 = group video call, 개인영통 = 1:1 video call. Empty if unclear.",
          },
          organizer: {
            type: "string",
            description: "Organizer / K-pop store name, or empty string.",
          },
          winners: {
            type: "integer",
            description: "당첨인원 / number of winners. 0 if not shown.",
          },
          polaroid: {
            type: "integer",
            description: "사인폴라 / number of signed polaroid winners. 0 if not shown.",
          },
          members: {
            type: "array",
            items: { type: "string" },
            description:
              "Participating members, using EXACTLY the spellings from the provided member list. Empty array if all members or not stated.",
          },
          notes: {
            type: "string",
            description: "Short note about anything uncertain (e.g. year assumed). Empty if none.",
          },
        },
      },
    },
  },
};

/**
 * @param {{images?: Array<{data: string, mediaType: string}>, image?: string, mediaType?: string,
 *          members?: string[], organizers?: string[]}} body
 *   images: one or more posters/pages of the SAME announcement; data is base64 (no data: prefix),
 *   mediaType is "image/jpeg" | "image/png" | "image/webp" | "image/gif".
 *   (A single `image` + `mediaType` is still accepted.)
 * @return {Array<Object>} extracted events
 */
function extractPoster(body) {
  var apiKey = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set in Script Properties.");
  var images = (body && body.images) || [];
  if (!images.length && body && body.image) {
    images = [{ data: body.image, mediaType: body.mediaType }];
  }
  if (!images.length) throw new Error("No poster image was received.");
  if (images.length > MAX_IMAGES) throw new Error("Please send at most " + MAX_IMAGES + " images.");

  var content = [];
  images.forEach(function (img, i) {
    var mediaType = img.mediaType || "image/jpeg";
    if (ALLOWED_MEDIA_TYPES.indexOf(mediaType) === -1) {
      throw new Error("Unsupported image type: " + mediaType);
    }
    if (!img.data) throw new Error("Image " + (i + 1) + " is empty.");
    if (images.length > 1) content.push({ type: "text", text: "Image " + (i + 1) + ":" });
    content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: img.data } });
  });

  var members = (body.members || []).join(", ") || "(none provided)";
  var organizers = (body.organizers || []).join(", ") || "(none yet)";
  var today = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd");

  var intro =
    images.length > 1
      ? "These " + images.length + " images are parts of ONE K-pop fansign event announcement " +
        "from an organizer or K-pop store (e.g. a poster plus detail/notice pages). Details may be " +
        "split across images: combine them, and do not list the same session twice.\n"
      : "This is a K-pop fansign event announcement poster from an organizer or K-pop store.\n";
  var prompt =
    intro +
    "Extract every fansign session it announces.\n\n" +
    "Today's date (KST) is " + today + ". If the poster omits the year, use the year that " +
    "puts the event on or after today and mention it in notes.\n" +
    "Use the event date itself, not the purchase/application period or winner-announcement date.\n" +
    "Known member names (use these exact spellings; map Korean/English/nicknames to them): " +
    members + "\n" +
    "Organizers already in the database (reuse an exact spelling if it is the same store): " +
    organizers + "\n" +
    "If something is not on the poster, leave it empty / 0 rather than guessing.";

  var payload = {
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: POSTER_SCHEMA },
    },
    fallbacks: "default",
    messages: [
      {
        role: "user",
        content: content.concat([{ type: "text", text: prompt }]),
      },
    ],
  };

  var response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2026-10-21",
      "anthropic-beta": "server-side-fallback-2026-07-01",
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  var status = response.getResponseCode();
  var result = JSON.parse(response.getContentText());
  if (status !== 200) {
    var msg = result && result.error ? result.error.message : response.getContentText();
    throw new Error("Claude API error (HTTP " + status + "): " + msg);
  }
  if (result.stop_reason === "refusal") {
    throw new Error("The poster could not be processed. Please fill in the details manually.");
  }
  if (result.stop_reason === "max_tokens") {
    throw new Error("The poster reply was cut off. Please try again or fill in manually.");
  }

  var text = (result.content || [])
    .filter(function (b) { return b.type === "text"; })
    .map(function (b) { return b.text; })
    .join("");
  var parsed = JSON.parse(text);
  return parsed.events || [];
}
