#!/usr/bin/env node
// The Pass — idempotent Notion build script. Zero deps (Node 18+ fetch).
// Usage: node build.mjs [--phase=all|preflight|structure|rail|seed|migrate|anchors]
// Reads NOTION_API_KEY from ~/.config/notion.env. Never prints the key.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HQ = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(homedir(), ".config", "notion.env");
const ANCHORS_PATH = join(HQ, "anchors.json");
const V_BUILD = "2022-06-28"; // stable single-source shapes for building
const V_DS = "2025-09-03"; // harvest data_source_ids for agents

function loadKey() {
  if (!existsSync(ENV_PATH)) throw new Error(`Missing ${ENV_PATH}`);
  const m = readFileSync(ENV_PATH, "utf8").match(/^NOTION_API_KEY=(.+)$/m);
  if (!m) throw new Error("NOTION_API_KEY not found in notion.env");
  return m[1].trim();
}
const KEY = loadKey();

let lastReq = 0;
async function api(path, { method = "GET", body, version = V_BUILD } = {}) {
  const wait = 350 - (Date.now() - lastReq); // ~3 rps
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastReq = Date.now();
  for (let attempt = 0; attempt < 5; attempt++) {
    let res;
    try {
      res = await fetch(`https://api.notion.com/v1${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${KEY}`,
          "Notion-Version": version,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      const backoff = 1000 * 2 ** attempt;
      console.log(`  retry (network: ${e.message}) in ${backoff}ms: ${path}`);
      await new Promise((r) => setTimeout(r, backoff));
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      const backoff = 1000 * 2 ** attempt;
      console.log(`  retry ${res.status} in ${backoff}ms: ${path}`);
      await new Promise((r) => setTimeout(r, backoff));
      continue;
    }
    const json = await res.json();
    if (!res.ok) throw new Error(`${res.status} ${path}: ${json.message}`);
    return json;
  }
  throw new Error(`gave up after retries: ${path}`);
}

// ---------- rich text helpers ----------
const rt = (text, ann = {}) => [
  { type: "text", text: { content: text }, annotations: ann },
];
const para = (text, ann) => ({
  type: "paragraph",
  paragraph: { rich_text: rt(text, ann) },
});
const bullet = (text) => ({
  type: "bulleted_list_item",
  bulleted_list_item: { rich_text: rt(text) },
});
const callout = (text, emoji, color = "default") => ({
  type: "callout",
  callout: { rich_text: rt(text), icon: { type: "emoji", emoji }, color },
});
const heading = (text, level = 2) => ({
  type: `heading_${level}`,
  [`heading_${level}`]: { rich_text: rt(text) },
});
const codeBlock = (content, language) => ({
  type: "code",
  code: { rich_text: rt(content), language },
});
const linkToPage = (page_id) => ({
  type: "link_to_page",
  link_to_page: { type: "page_id", page_id },
});
const divider = () => ({ type: "divider", divider: {} });

// ---------- markdown → blocks (for protocols.md) ----------
function mdToBlocks(md) {
  const blocks = [];
  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    if (line.startsWith("## ")) blocks.push(heading(line.slice(3), 2));
    else if (line.startsWith("# ")) blocks.push(heading(line.slice(2), 1));
    else if (line.startsWith("> "))
      blocks.push(callout(line.slice(2), "▪", "gray_background"));
    else if (/^- /.test(line)) blocks.push(bullet(line.slice(2)));
    else if (/^\d+\. /.test(line))
      blocks.push({
        type: "numbered_list_item",
        numbered_list_item: { rich_text: rt(line.replace(/^\d+\. /, "")) },
      });
    else blocks.push(para(line));
  }
  return blocks;
}

// ---------- search helpers (idempotency) ----------
async function findPage(title, parentId = null) {
  const res = await api("/search", {
    method: "POST",
    body: { query: title, filter: { property: "object", value: "page" } },
  });
  return res.results.find((p) => {
    const t =
      p.properties?.title?.title?.map((x) => x.plain_text).join("") ?? "";
    const ok = t.trim().toLowerCase() === title.trim().toLowerCase();
    return parentId
      ? ok &&
          p.parent?.page_id?.replace(/-/g, "") === parentId.replace(/-/g, "")
      : ok;
  });
}
async function findDb(title) {
  const res = await api("/search", {
    method: "POST",
    body: { query: title, filter: { property: "object", value: "database" } },
  });
  return res.results.find(
    (d) =>
      (d.title?.map((x) => x.plain_text).join("") ?? "")
        .trim()
        .toLowerCase() === title.trim().toLowerCase(),
  );
}

const sel = (opts) => ({
  select: { options: opts.map(([name, color]) => ({ name, color })) },
});

const anchors = existsSync(ANCHORS_PATH)
  ? JSON.parse(readFileSync(ANCHORS_PATH, "utf8"))
  : {};
const save = () =>
  writeFileSync(ANCHORS_PATH, JSON.stringify(anchors, null, 2));

// ---------- phases ----------
async function preflight() {
  const me = await api("/users/me");
  console.log(`token OK — bot: ${me.name}`);
  const pass = await findPage("The Pass");
  if (!pass)
    throw new Error("Page 'The Pass' not found or not shared with param-hq.");
  anchors.pass_page = pass.id;
  const railDb = await findDb("Rail");
  if (!railDb)
    throw new Error("Database 'Rail' not found or not shared with param-hq.");
  anchors.rail_db = railDb.id;
  const railPage = await findPage("The Rail");
  if (railPage) anchors.rail_page = railPage.id;
  save();
  console.log("preflight OK", {
    pass: !!pass,
    railDb: !!railDb,
    railPage: !!railPage,
  });
}

async function structure() {
  // Decorate The Pass
  await api(`/pages/${anchors.pass_page}`, {
    method: "PATCH",
    body: { icon: { type: "emoji", emoji: "🛎️" } },
  });
  // Homepage blocks (skip if already present)
  const kids = await api(`/blocks/${anchors.pass_page}/children?page_size=20`);
  const hasNorthStar = kids.results.some(
    (b) =>
      b.type === "callout" &&
      b.callout.rich_text?.[0]?.plain_text?.startsWith("North star"),
  );
  if (!hasNorthStar) {
    const res = await api(`/blocks/${anchors.pass_page}/children`, {
      method: "PATCH",
      body: {
        children: [
          callout(
            "North star: well-being + cognitive sovereignty — a mind that stays mine.",
            "🧭",
            "gray_background",
          ),
          callout(
            "Today — agents write this every morning at 07:30.",
            "🎫",
            "default",
          ),
          {
            type: "toggle",
            toggle: {
              rich_text: rt("The Map"),
              children: [codeBlock(buildMermaid(), "mermaid")],
            },
          },
          divider(),
        ],
      },
    });
    anchors.northstar_callout = res.results[0].id;
    anchors.today_callout = res.results[1].id;
    anchors.map_toggle = res.results[2].id;
    const toggleKids = await api(`/blocks/${anchors.map_toggle}/children`);
    anchors.map_code_block = toggleKids.results.find(
      (b) => b.type === "code",
    )?.id;
    // Today callout placeholder children (incl. Rail link)
    await api(`/blocks/${anchors.today_callout}/children`, {
      method: "PATCH",
      body: {
        children: [
          linkToPage(anchors.rail_page ?? anchors.pass_page),
          para("NOW → — focus-kickoff picks at 09:30", { bold: true }),
          para("PEAK 10:30–16:00 — Flow only"),
        ],
      },
    });
  } else {
    // recover anchor ids from existing blocks
    anchors.northstar_callout = kids.results.find(
      (b) =>
        b.type === "callout" &&
        b.callout.rich_text?.[0]?.plain_text?.startsWith("North star"),
    )?.id;
    anchors.today_callout = kids.results.find(
      (b) => b.type === "callout" && b.id !== anchors.northstar_callout,
    )?.id;
    const tog = kids.results.find((b) => b.type === "toggle");
    anchors.map_toggle = tog?.id;
    if (tog) {
      const tk = await api(`/blocks/${tog.id}/children`);
      anchors.map_code_block = tk.results.find((b) => b.type === "code")?.id;
    }
  }
  // Drawers
  let drawers = await findPage("Drawers", anchors.pass_page);
  if (!drawers)
    drawers = await api("/pages", {
      method: "POST",
      body: {
        parent: { page_id: anchors.pass_page },
        icon: { type: "emoji", emoji: "🗄️" },
        properties: { title: { title: rt("Drawers") } },
      },
    });
  anchors.drawers_page = drawers.id;
  save();
  console.log("structure OK");
}

async function makeDb(key, title, emoji, properties) {
  let db = await findDb(title);
  if (!db) {
    db = await api("/databases", {
      method: "POST",
      body: {
        parent: { type: "page_id", page_id: anchors.drawers_page },
        icon: { type: "emoji", emoji },
        title: rt(title),
        properties,
      },
    });
    console.log(`created DB ${title}`);
  } else console.log(`DB ${title} exists`);
  anchors[key] = db.id;
  save();
  return db.id;
}

async function databases() {
  await makeDb("goals_db", "Goals", "🎯", {
    Name: { title: {} },
    Horizon: sel([
      ["Now", "red"],
      ["Quarter", "orange"],
      ["Year", "blue"],
      ["Long", "purple"],
    ]),
    Target: { date: {} },
    Status: sel([
      ["Alive", "green"],
      ["Achieved", "blue"],
      ["Dropped", "gray"],
    ]),
    Why: { rich_text: {} },
    Measure: { rich_text: {} },
  });
  await makeDb("projects_db", "Projects", "🛠️", {
    Name: { title: {} },
    Status: sel([
      ["Active", "green"],
      ["Parked", "yellow"],
      ["Blocked", "red"],
      ["Dormant", "gray"],
      ["Done", "blue"],
    ]),
    Area: sel([
      ["Build", "blue"],
      ["Write", "orange"],
      ["Learn", "purple"],
      ["Career", "green"],
    ]),
    Goal: {
      relation: {
        database_id: anchors.goals_db,
        type: "dual_property",
        dual_property: {},
      },
    },
    "One-liner": { rich_text: {} },
    Deadline: { date: {} },
    "Blocked on": { rich_text: {} },
    Link: { url: {} },
  });
  await makeDb("library_db", "Library", "📚", {
    Name: { title: {} },
    Kind: sel([
      ["Doc", "blue"],
      ["Reference", "gray"],
      ["Idea", "yellow"],
      ["Someday", "purple"],
      ["Queue", "orange"],
    ]),
    Area: sel([
      ["Build", "blue"],
      ["Write", "orange"],
      ["Learn", "purple"],
      ["Career", "green"],
    ]),
    Project: {
      relation: {
        database_id: anchors.projects_db,
        type: "dual_property",
        dual_property: {},
      },
    },
    Pinned: { checkbox: {} },
    Source: { url: {} },
  });
  await makeDb("daybook_db", "Daybook", "📆", {
    Name: { title: {} },
    Date: { date: {} },
    Mode: sel([
      ["Push", "green"],
      ["Steady", "yellow"],
      ["Recover", "red"],
    ]),
    "Recovery %": { number: {} },
    Shipped: { rich_text: {} },
    Cohered: { checkbox: {} },
  });
  await makeDb("wins_db", "Wins", "🏆", {
    Name: { title: {} },
    Date: { date: {} },
    Kind: sel([
      ["Shipped", "green"],
      ["Streak", "orange"],
      ["Milestone", "purple"],
      ["First", "pink"],
    ]),
    Project: {
      relation: {
        database_id: anchors.projects_db,
        type: "dual_property",
        dual_property: {},
      },
    },
  });
}

async function railRetrofit() {
  const db = await api(`/databases/${anchors.rail_db}`);
  const props = {};
  if (!db.properties.Project)
    props.Project = {
      relation: {
        database_id: anchors.projects_db,
        type: "dual_property",
        dual_property: {},
      },
    };
  if (!db.properties.Load)
    props.Load = sel([
      ["Flow", "orange"],
      ["Light", "gray"],
    ]);
  if (!db.properties.Why) props.Why = { rich_text: {} };
  if (Object.keys(props).length)
    await api(`/databases/${anchors.rail_db}`, {
      method: "PATCH",
      body: { properties: props },
    });
  console.log("rail retrofit OK", Object.keys(props));
}

async function queryAll(dbId, filter) {
  const rows = [];
  let cursor;
  do {
    const res = await api(`/databases/${dbId}/query`, {
      method: "POST",
      body: {
        ...(filter ? { filter } : {}),
        ...(cursor ? { start_cursor: cursor } : {}),
        page_size: 100,
      },
    });
    rows.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return rows;
}
const titleOf = (page) => {
  const tp = Object.values(page.properties).find((p) => p.type === "title");
  return tp?.title?.map((x) => x.plain_text).join("") ?? "";
};

async function seed() {
  // Goals
  const goals = JSON.parse(readFileSync(join(HQ, "seed/goals.json"), "utf8"));
  const existingGoals = await queryAll(anchors.goals_db);
  const goalIds = {};
  for (const g of goals) {
    const found = existingGoals.find((p) => titleOf(p) === g.name);
    if (found) {
      goalIds[g.name] = found.id;
      continue;
    }
    const page = await api("/pages", {
      method: "POST",
      body: {
        parent: { database_id: anchors.goals_db },
        properties: {
          Name: { title: rt(g.name) },
          Horizon: { select: { name: g.horizon } },
          Status: { select: { name: g.status } },
          ...(g.target ? { Target: { date: { start: g.target } } } : {}),
          Why: { rich_text: rt(g.why) },
          Measure: { rich_text: rt(g.measure) },
        },
      },
    });
    goalIds[g.name] = page.id;
    console.log(`goal: ${g.name}`);
  }
  // Projects
  const projects = JSON.parse(
    readFileSync(join(HQ, "seed/projects.json"), "utf8"),
  );
  const existingProjects = await queryAll(anchors.projects_db);
  const projIds = {};
  for (const p of projects) {
    const found = existingProjects.find((x) => titleOf(x) === p.name);
    if (found) {
      projIds[p.name] = found.id;
      continue;
    }
    const page = await api("/pages", {
      method: "POST",
      body: {
        parent: { database_id: anchors.projects_db },
        properties: {
          Name: { title: rt(p.name) },
          Status: { select: { name: p.status } },
          Area: { select: { name: p.area } },
          ...(p.goal && goalIds[p.goal]
            ? { Goal: { relation: [{ id: goalIds[p.goal] }] } }
            : {}),
          "One-liner": { rich_text: rt(p.oneliner) },
          ...(p.deadline ? { Deadline: { date: { start: p.deadline } } } : {}),
          ...(p.blocked_on
            ? { "Blocked on": { rich_text: rt(p.blocked_on) } }
            : {}),
          ...(p.link ? { Link: { url: p.link } } : {}),
        },
      },
    });
    projIds[p.name] = page.id;
    console.log(`project: ${p.name}`);
  }
  anchors.project_ids = projIds;
  // Daybook today
  const today = new Date();
  const dayTitle = today.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const existingDays = await queryAll(anchors.daybook_db);
  if (!existingDays.some((d) => titleOf(d) === dayTitle)) {
    await api("/pages", {
      method: "POST",
      body: {
        parent: { database_id: anchors.daybook_db },
        properties: {
          Name: { title: rt(dayTitle) },
          Date: {
            date: {
              start: today.toLocaleDateString("en-CA", {
                timeZone: "Asia/Kolkata",
              }),
            },
          },
          Mode: { select: { name: "Steady" } },
        },
        children: [
          heading("Plan"),
          para("Agents take over tomorrow 06:30."),
          heading("Coherence"),
          heading("Evening"),
        ],
      },
    });
  }
  // Wins
  const wins = await queryAll(anchors.wins_db);
  if (!wins.some((w) => titleOf(w) === "Built the Rail")) {
    await api("/pages", {
      method: "POST",
      body: {
        parent: { database_id: anchors.wins_db },
        properties: {
          Name: { title: rt("Built the Rail") },
          Date: { date: { start: "2026-08-23" } },
          Kind: { select: { name: "First" } },
        },
      },
    });
  }
  // Protocols page
  let prot = await findPage("Protocols", anchors.drawers_page);
  if (!prot) {
    const md = readFileSync(join(HQ, "content/protocols.md"), "utf8");
    const blocks = mdToBlocks(md).slice(0, 95);
    prot = await api("/pages", {
      method: "POST",
      body: {
        parent: { page_id: anchors.drawers_page },
        icon: { type: "emoji", emoji: "📖" },
        properties: { title: { title: rt("Protocols") } },
        children: blocks,
      },
    });
  }
  anchors.protocols_page = prot.id;
  // Back office
  let bo = await findPage("Back office", anchors.drawers_page);
  if (!bo)
    bo = await api("/pages", {
      method: "POST",
      body: {
        parent: { page_id: anchors.drawers_page },
        icon: { type: "emoji", emoji: "🔧" },
        properties: { title: { title: rt("Back office") } },
        children: [
          heading("Anchors"),
          codeBlock("{}", "json"),
          heading("Decay reports"),
          codeBlock("{}", "json"),
        ],
      },
    });
  anchors.backoffice_page = bo.id;
  const boKids = await api(`/blocks/${anchors.backoffice_page}/children`);
  const codeBlocks = boKids.results.filter((b) => b.type === "code");
  anchors.backoffice_anchors_block = codeBlocks[0]?.id;
  anchors.decay_block = codeBlocks[1]?.id;
  save();
  console.log("seed OK");
}

async function migrate() {
  const map = JSON.parse(
    readFileSync(join(HQ, "seed/library-migration.json"), "utf8"),
  );
  const cards = await queryAll(anchors.rail_db, {
    property: "Lane",
    select: { does_not_equal: "Done" },
  });
  for (const card of cards) {
    const t = titleOf(card).toLowerCase();
    const rule = map.migrate.find((r) => t.includes(r.match));
    const dropRule = map.drop.find((r) => t.includes(r.match));
    if (dropRule) {
      await api(`/pages/${card.id}`, {
        method: "PATCH",
        body: { properties: { Lane: { select: { name: "Done" } } } },
      });
      console.log(`dropped (Done): ${titleOf(card)} — ${dropRule.note}`);
      continue;
    }
    if (!rule) continue;
    // copy card block content
    const kids = await api(`/blocks/${card.id}/children?page_size=100`);
    const safe = kids.results
      .filter((b) =>
        [
          "paragraph",
          "bulleted_list_item",
          "numbered_list_item",
          "to_do",
          "quote",
          "heading_1",
          "heading_2",
          "heading_3",
          "code",
          "callout",
          "divider",
          "toggle",
        ].includes(b.type),
      )
      .map((b) => {
        const copy = { type: b.type, [b.type]: { ...b[b.type] } };
        delete copy[b.type].children; // nested children not copied (flat copy)
        return copy;
      });
    await api("/pages", {
      method: "POST",
      body: {
        parent: { database_id: anchors.library_db },
        properties: {
          Name: { title: rt(titleOf(card)) },
          Kind: { select: { name: rule.kind } },
          Area: { select: { name: rule.area } },
        },
        ...(safe.length ? { children: safe.slice(0, 95) } : {}),
      },
    });
    await api(`/pages/${card.id}`, {
      method: "PATCH",
      body: { archived: true },
    });
    console.log(`migrated → Library: ${titleOf(card)}`);
  }
  console.log("migrate OK");
}

function buildMermaid() {
  return `flowchart TD
  NS(["NORTH STAR — well-being + cognitive sovereignty"]):::ns
  NS --> G1["BlueDot AI Safety · Sep 7"]
  NS --> G2["Parameters · essay/week"]
  NS --> G3["German A1 · Sep"]
  NS --> G4["Frontier-lab hire"]
  NS --> G5["Relocation reset"]
  G1 --> P1["BlueDot prep"]
  G2 --> P2["Parameters"]
  G3 --> P3["German Month"]
  G4 --> P4["Frontier hire push"]
  G5 --> P5["Relocation reset"]
  NS -.-> PK["parked & dormant"]:::dim
  P1 & P2 & P3 --> TODAY(("today's NOW card"))
  classDef ns fill:#1a1a2e,color:#fff,stroke:#c96f4f
  classDef dim fill:#eeeeee,color:#999999,stroke:#cccccc`;
}

async function harvestAnchors() {
  // data_source_ids for the agents (2025-09 API)
  anchors.data_sources = {};
  for (const key of [
    "rail_db",
    "goals_db",
    "projects_db",
    "library_db",
    "daybook_db",
    "wins_db",
  ]) {
    const db = await api(`/databases/${anchors[key]}`, { version: V_DS });
    anchors.data_sources[key] = db.data_sources?.[0]?.id ?? anchors[key];
  }
  anchors.dump_note_title = anchors.dump_note_title ?? "Dump";
  anchors.archive_note_title =
    anchors.archive_note_title ?? "Dump — cohered archive";
  // Aliases matching the agent prompts' expected key names (hq/prompts/*.md)
  anchors.today_callout_id = anchors.today_callout;
  anchors.rail_page_id = anchors.rail_page;
  anchors.back_office_page_id = anchors.backoffice_page;
  anchors.decay_block_id = anchors.decay_block;
  anchors.life_map_block_id = anchors.map_code_block;
  anchors.parameters_project_id = anchors.project_ids?.["Parameters"];
  for (const [key, dsId] of Object.entries(anchors.data_sources)) {
    anchors[key.replace(/_db$/, "_data_source_id")] = dsId; // e.g. rail_data_source_id
    anchors[`${key}_id`] = anchors[key]; // e.g. rail_db_id
  }
  save();
  // mirror into Back office
  if (anchors.backoffice_anchors_block) {
    await api(`/blocks/${anchors.backoffice_anchors_block}`, {
      method: "PATCH",
      body: {
        code: {
          rich_text: rt(JSON.stringify(anchors, null, 2).slice(0, 1990)),
          language: "json",
        },
      },
    });
  }
  console.log("anchors harvested + mirrored");
}

const phase = (
  process.argv.find((a) => a.startsWith("--phase=")) ?? "--phase=all"
).split("=")[1];
const run = async () => {
  if (["all", "preflight"].includes(phase)) await preflight();
  if (["all", "structure"].includes(phase)) await structure();
  if (["all", "structure"].includes(phase)) await databases();
  if (["all", "rail"].includes(phase)) await railRetrofit();
  if (["all", "seed"].includes(phase)) await seed();
  if (["all", "migrate"].includes(phase)) await migrate();
  if (["all", "anchors"].includes(phase)) await harvestAnchors();
  console.log("DONE. anchors.json written.");
};
run().catch((e) => {
  console.error("BUILD FAILED:", e.message);
  process.exit(1);
});
