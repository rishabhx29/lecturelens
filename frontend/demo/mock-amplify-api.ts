import type { StudyPack } from "../src/common/types";

/**
 * Local demo replacement for `aws-amplify/api`.
 *
 * It keeps documents, conversations, and Study Pack state in memory so the
 * real LectureLens UI can be clicked through without AWS credentials. AI
 * answers and the Study Pack are simulated; the deployed app calls Bedrock.
 */

export type MockStatus =
  | "NOT_GENERATED"
  | "QUEUED"
  | "PROCESSING"
  | "READY"
  | "FAILED";

interface DemoMessage {
  type: "text" | "ai";
  data: {
    content: string;
    example: boolean;
    additional_kwargs: Record<string, unknown>;
  };
}

interface DemoConversation {
  conversationid: string;
  documentid: string;
  messages: DemoMessage[];
}

interface DemoDocument {
  documentid: string;
  userid: string;
  filename: string;
  filesize: string;
  docstatus: string;
  created: string;
  pages: string;
  conversations: { conversationid: string; created: string }[];
}

interface StudyPackState {
  status: MockStatus;
  studyPack: StudyPack | null;
  updated: string | null;
  error: string | null;
}

export interface MockRequest {
  apiName?: string;
  path: string;
  options?: {
    body?: unknown;
    queryParams?: Record<string, string>;
    headers?: Record<string, string>;
  };
}

const documents = new Map<string, DemoDocument>();
const conversations = new Map<string, DemoConversation>();
const studyPacks = new Map<string, StudyPackState>();

let idCounter = 0;
const nextId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(idCounter += 1)}`;
const nowIso = () => new Date().toISOString();
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function seed() {
  if (documents.size > 0) return;

  const documentId = "doc-cell-biology";
  const conversationId = "conv-cell-biology-1";
  const created = new Date(Date.now() - 90 * 60 * 1000).toISOString();

  documents.set(documentId, {
    documentid: documentId,
    userid: "local-demo-user",
    filename: "cell-biology-lecture.pdf",
    filesize: "9230",
    docstatus: "READY",
    created,
    pages: "4",
    conversations: [{ conversationid: conversationId, created }],
  });

  conversations.set(conversationId, {
    conversationid: conversationId,
    documentid: documentId,
    messages: [
      {
        type: "ai",
        data: {
          content:
            "Welcome to the local LectureLens demo. The AI answers here are simulated; the deployed app calls Amazon Bedrock. I've preloaded the cell biology lecture, so ask a question or open the Study Pack.",
          example: true,
          additional_kwargs: {},
        },
      },
      {
        type: "text",
        data: {
          content: "What is the main function of the plasma membrane?",
          example: false,
          additional_kwargs: {},
        },
      },
      {
        type: "ai",
        data: {
          content:
            "The plasma membrane is a selectively permeable phospholipid bilayer that controls what enters and leaves the cell. Its proteins also handle transport and signaling: channel proteins let specific ions through, carrier proteins change shape to move substances, and receptor proteins bind signaling molecules (page 2).",
          example: false,
          additional_kwargs: {},
        },
      },
    ],
  });

  studyPacks.set(documentId, {
    status: "NOT_GENERATED",
    studyPack: null,
    updated: null,
    error: null,
  });
}

seed();

function documentView(document: DemoDocument) {
  return {
    ...document,
    conversations: document.conversations.map((item) => ({ ...item })),
  };
}

function conversationView(conversation: DemoConversation) {
  const document = documents.get(conversation.documentid);
  return {
    conversationid: conversation.conversationid,
    document: document ? documentView(document) : null,
    messages: conversation.messages.map((message) => ({
      type: message.type,
      data: { ...message.data, additional_kwargs: { ...message.data.additional_kwargs } },
    })),
  };
}

function defaultStudyPackState(): StudyPackState {
  return { status: "NOT_GENERATED", studyPack: null, updated: null, error: null };
}

function findConversation(documentId: string, conversationId: string) {
  const existing = conversations.get(conversationId);
  if (existing) return existing;

  const created: DemoConversation = {
    conversationid: conversationId,
    documentid: documentId,
    messages: [],
  };
  conversations.set(conversationId, created);
  const document = documents.get(documentId);
  if (document && !document.conversations.some((item) => item.conversationid === conversationId)) {
    document.conversations.push({ conversationid: conversationId, created: nowIso() });
  }
  return created;
}

async function handleMessagePost(
  documentId: string,
  conversationId: string,
  body: unknown
) {
  const prompt = String(
    (body as Record<string, unknown> | undefined)?.prompt ?? ""
  ).trim();
  const conversation = findConversation(documentId, conversationId);

  if (prompt) {
    conversation.messages.push({
      type: "text",
      data: { content: prompt, example: false, additional_kwargs: {} },
    });
    await delay(1400);
    conversation.messages.push({
      type: "ai",
      data: { content: answerFor(prompt), example: false, additional_kwargs: {} },
    });
  }

  return {};
}

async function route(method: string, request: MockRequest): Promise<unknown> {
  const path = request.path.replace(/^\/+/, "");
  const query = request.options?.queryParams ?? {};
  const body = request.options?.body;

  if (method === "GET" && path === "generate_presigned_url") {
    const filename = String(query.file_name ?? "lecture.pdf");
    const documentId = nextId("doc");
    const conversationId = nextId("conv");
    const created = nowIso();

    documents.set(documentId, {
      documentid: documentId,
      userid: "local-demo-user",
      filename,
      filesize: "9230",
      docstatus: "PROCESSING",
      created,
      pages: "-",
      conversations: [{ conversationid: conversationId, created }],
    });
    conversations.set(conversationId, {
      conversationid: conversationId,
      documentid: documentId,
      messages: [],
    });
    studyPacks.set(documentId, defaultStudyPackState());

    return { presignedurl: `mock-upload://${documentId}` };
  }

  if (method === "GET" && path === "doc") {
    return [...documents.values()]
      .sort((a, b) => b.created.localeCompare(a.created))
      .map(documentView);
  }

  const studyPackMatch = path.match(/^doc\/([^/]+)\/study-pack$/);
  if (studyPackMatch) {
    const documentId = decodeURIComponent(studyPackMatch[1]);
    const state = studyPacks.get(documentId) ?? defaultStudyPackState();

    if (method === "GET") {
      return { ...state };
    }

    if (method === "POST") {
      if (state.status === "READY" && state.studyPack) {
        return { ...state };
      }

      const started = nowIso();
      studyPacks.set(documentId, {
        status: "PROCESSING",
        studyPack: null,
        updated: started,
        error: null,
      });

      window.setTimeout(() => {
        studyPacks.set(documentId, {
          status: "READY",
          studyPack: buildStudyPack(),
          updated: nowIso(),
          error: null,
        });
      }, 6000);

      return {
        status: "PROCESSING",
        studyPack: null,
        updated: started,
        error: null,
      };
    }
  }

  const prefixedConversation = path.match(/^doc\/([^/]+)\/([^/]+)$/);
  if (prefixedConversation) {
    const documentId = decodeURIComponent(prefixedConversation[1]);
    const conversationId = decodeURIComponent(prefixedConversation[2]);

    if (method === "GET") {
      return conversationView(findConversation(documentId, conversationId));
    }

    if (method === "POST") {
      return handleMessagePost(documentId, conversationId, body);
    }
  }

  const bareConversation = path.match(/^([^/]+)\/([^/]+)$/);
  if (bareConversation && method === "POST") {
    const documentId = decodeURIComponent(bareConversation[1]);
    const conversationId = decodeURIComponent(bareConversation[2]);
    return handleMessagePost(documentId, conversationId, body);
  }

  const documentMatch = path.match(/^doc\/([^/]+)$/);
  if (documentMatch) {
    const documentId = decodeURIComponent(documentMatch[1]);
    const document = documents.get(documentId);

    if (method === "DELETE") {
      documents.delete(documentId);
      studyPacks.delete(documentId);
      for (const [conversationId, conversation] of conversations) {
        if (conversation.documentid === documentId) {
          conversations.delete(conversationId);
        }
      }
      return {};
    }

    if (method === "POST" && document) {
      const conversationId = nextId("conv");
      document.conversations.push({ conversationid: conversationId, created: nowIso() });
      const conversation: DemoConversation = {
        conversationid: conversationId,
        documentid: documentId,
        messages: [],
      };
      conversations.set(conversationId, conversation);
      return conversationView(conversation);
    }

    if (method === "GET" && document) {
      return documentView(document);
    }
  }

  return {};
}

function toHttpResponse(payload: unknown) {
  return {
    statusCode: 200,
    body: {
      json: async () => JSON.parse(JSON.stringify(payload)),
    },
  };
}

export function get(request: MockRequest) {
  return { response: route("GET", request).then(toHttpResponse) };
}

export function post(request: MockRequest) {
  return { response: route("POST", request).then(toHttpResponse) };
}

export function del(request: MockRequest) {
  return { response: route("DELETE", request).then(toHttpResponse) };
}

export function finishUpload(documentId: string) {
  const document = documents.get(documentId);
  if (!document) return;

  document.docstatus = "READY";
  document.pages = "4";
  document.filesize = "9230";

  const conversationId = document.conversations[0]?.conversationid;
  if (!conversationId) return;

  const conversation = findConversation(documentId, conversationId);
  if (conversation.messages.length === 0) {
    conversation.messages.push({
      type: "ai",
      data: {
        content:
          "Your lecture is ready. Ask a question, or open the Study Pack to generate a summary, key concepts, flashcards, and a quiz.",
        example: true,
        additional_kwargs: {},
      },
    });
  }
}

export function installMockFetch() {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url.startsWith("mock-upload://")) {
      const documentId = url.slice("mock-upload://".length);
      await delay(1200);
      finishUpload(documentId);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return originalFetch(input, init);
  };
}

const ANSWERS: { keywords: string[]; answer: string }[] = [
  {
    keywords: ["plasma membrane", "phospholipid", "fluid mosaic"],
    answer:
      "The plasma membrane is a selectively permeable phospholipid bilayer. Each phospholipid has a hydrophilic head and two hydrophobic tails, so the tails face inward and the heads face outward. The fluid mosaic model describes it as a flexible mix of phospholipids, proteins, cholesterol, and carbohydrates (page 2).",
  },
  {
    keywords: ["sodium", "potassium", "pump", "active transport", "passive transport", "diffusion", "osmosis"],
    answer:
      "Passive transport moves substances from higher to lower concentration without ATP (diffusion and osmosis). Active transport moves substances against the gradient and needs energy. The sodium-potassium pump is the classic example: it moves three Na+ ions out and two K+ ions in for each ATP used (page 2).",
  },
  {
    keywords: ["mitochond", "atp", "cristae", "respiration", "electron transport"],
    answer:
      "Mitochondria are the main site of aerobic respiration. Their inner membrane folds into cristae, which increase the surface area for the electron transport chain. Electrons from NADH and FADH2 pump protons into the intermembrane space, and ATP synthase uses that flow to produce most of the cell's ATP (page 3).",
  },
  {
    keywords: ["prokaryot", "eukaryot", "nucleoid", "nucleus"],
    answer:
      "Prokaryotic cells, such as bacteria, have no membrane-bound nucleus; their DNA sits in the nucleoid. Eukaryotic cells have a membrane-bound nucleus and organelles that separate chemical reactions into compartments (page 1).",
  },
  {
    keywords: ["ribosome", "translation", "mrna", "protein synthesis"],
    answer:
      "Ribosomes translate messenger RNA into proteins. They can float freely in the cytoplasm or attach to the rough endoplasmic reticulum, which helps fold and modify the proteins they produce (page 3).",
  },
  {
    keywords: ["photosynthesis", "chloroplast", "calvin", "thylakoid", "chlorophyll"],
    answer:
      "Chloroplasts carry out photosynthesis: light energy, carbon dioxide, and water become glucose and oxygen. The light-dependent reactions occur in the thylakoid membranes, and the Calvin cycle occurs in the stroma (page 3).",
  },
  {
    keywords: ["mitosis", "meiosis", "cell division", "cell cycle", "gamete"],
    answer:
      "Mitosis produces two genetically identical daughter cells and is used for growth, repair, and asexual reproduction. Meiosis produces gametes with half the chromosome number and creates variation through crossing over and independent assortment. The cell cycle is interphase (G1, S, G2), mitosis, and cytokinesis (page 4).",
  },
  {
    keywords: ["fermentation", "lactic", "alcoholic", "anaerobic"],
    answer:
      "Fermentation happens when oxygen is unavailable. It regenerates NAD+ so glycolysis can continue. Lactic acid fermentation produces lactate, alcoholic fermentation produces ethanol and CO2, and both make far less ATP than aerobic respiration (page 3).",
  },
  {
    keywords: ["golgi", "lysosome", "vacuole", "organelle"],
    answer:
      "The Golgi apparatus modifies, sorts, and packages proteins and lipids. Lysosomes contain digestive enzymes that break down worn-out organelles and invaders, and vacuoles store water, nutrients, and waste. Plant cells usually have a large central vacuole for turgor pressure (page 3).",
  },
];

function answerFor(prompt: string) {
  const lower = prompt.toLowerCase();
  for (const entry of ANSWERS) {
    if (entry.keywords.some((keyword) => lower.includes(keyword))) {
      return entry.answer;
    }
  }

  return "This lecture covers cell theory, the plasma membrane, organelles, energy and metabolism, and cell division. Try asking about the membrane, active transport, mitochondria, ATP, ribosomes, photosynthesis, mitosis, or meiosis. You can also open the Study Pack for a structured summary (pages 1-4).";
}

function buildStudyPack(): StudyPack {
  return JSON.parse(JSON.stringify(STUDY_PACK)) as StudyPack;
}

const STUDY_PACK: StudyPack = {
  title: "Cell Biology: Cells, Membranes, and Energy",
  summary:
    "This lecture introduces cell theory and the two major cell types, then explains how the selectively permeable plasma membrane controls transport. It surveys the main organelles and their roles, and traces how cells produce and use energy through ATP, cellular respiration, fermentation, and photosynthesis. It closes with cell division, comparing mitosis with meiosis and listing key facts to remember.",
  keyConcepts: [
    {
      term: "Cell theory",
      definition:
        "All living organisms are made of one or more cells, and all cells arise from existing cells; the cell is the basic unit of life.",
    },
    {
      term: "Prokaryotic vs. eukaryotic cells",
      definition:
        "Prokaryotic cells (bacteria) lack a membrane-bound nucleus and keep DNA in the nucleoid. Eukaryotic cells have a nucleus and membrane-bound organelles.",
    },
    {
      term: "Fluid mosaic model",
      definition:
        "The plasma membrane is a flexible mosaic of a phospholipid bilayer, proteins, cholesterol, and carbohydrates.",
    },
    {
      term: "Passive vs. active transport",
      definition:
        "Passive transport moves substances down their concentration gradient without ATP; active transport moves them against the gradient using ATP.",
    },
    {
      term: "ATP",
      definition:
        "Adenosine triphosphate, the universal energy currency of the cell. Breaking the terminal phosphate bond releases energy for cellular work.",
    },
    {
      term: "Cellular respiration",
      definition:
        "Glycolysis, the Krebs cycle, and the electron transport chain convert glucose and oxygen into ATP, carbon dioxide, and water.",
    },
    {
      term: "Endosymbiotic theory",
      definition:
        "Mitochondria and chloroplasts may have evolved from free-living bacteria engulfed by an ancestral eukaryotic cell; both have double membranes and their own DNA.",
    },
  ],
  flashcards: [
    {
      front: "What is the function of the plasma membrane?",
      back: "It is a selectively permeable phospholipid bilayer that controls what enters and leaves the cell.",
    },
    {
      front: "What does the sodium-potassium pump do?",
      back: "For each ATP used, it moves three Na+ ions out of the cell and two K+ ions in (active transport).",
    },
    {
      front: "Which organelle produces most of the cell's ATP?",
      back: "Mitochondria, through aerobic respiration in the cristae of the inner membrane.",
    },
    {
      front: "What happens during the Krebs cycle?",
      back: "It occurs in the mitochondrial matrix, finishes oxidizing pyruvate, and produces NADH, FADH2, and a little ATP.",
    },
    {
      front: "Where does translation take place?",
      back: "At ribosomes, which translate mRNA into proteins; they can be free or attached to the rough endoplasmic reticulum.",
    },
    {
      front: "What is the endosymbiotic theory?",
      back: "Mitochondria and chloroplasts may have evolved from free-living bacteria; both have double membranes and their own DNA.",
    },
    {
      front: "How does mitosis differ from meiosis?",
      back: "Mitosis makes two identical daughter cells for growth and repair; meiosis makes gametes with half the chromosome number and increases genetic variation.",
    },
    {
      front: "Why does fermentation happen?",
      back: "When oxygen is unavailable, it regenerates NAD+ so glycolysis can continue, producing much less ATP than aerobic respiration.",
    },
    {
      front: "Where do the light-dependent reactions and Calvin cycle occur?",
      back: "Light-dependent reactions occur in the thylakoid membranes; the Calvin cycle occurs in the stroma of the chloroplast.",
    },
    {
      front: "What is the role of the Golgi apparatus?",
      back: "It modifies, sorts, and packages proteins and lipids for transport, like the cell's post office.",
    },
  ],
  quiz: [
    {
      question: "Which statement best describes prokaryotic cells?",
      options: [
        "They have a membrane-bound nucleus.",
        "They lack a membrane-bound nucleus.",
        "They have no genetic material.",
        "They contain chloroplasts.",
      ],
      answerIndex: 1,
      explanation:
        "Prokaryotes keep their DNA in the nucleoid region and do not have a membrane-bound nucleus (page 1).",
    },
    {
      question:
        "What is the main difference between passive and active transport?",
      options: [
        "Passive transport requires ATP; active transport does not.",
        "Active transport requires ATP; passive transport does not.",
        "Both require ATP.",
        "Neither uses membrane proteins.",
      ],
      answerIndex: 1,
      explanation:
        "Active transport moves substances against their concentration gradient and needs energy, while passive transport does not (page 2).",
    },
    {
      question: "Where does the electron transport chain occur?",
      options: [
        "In the cytoplasm",
        "In the mitochondrial matrix",
        "In the inner mitochondrial membrane",
        "In the nucleus",
      ],
      answerIndex: 2,
      explanation:
        "The electron transport chain sits in the inner mitochondrial membrane, where the cristae increase surface area (page 3).",
    },
    {
      question: "Which process produces the most ATP per glucose molecule?",
      options: [
        "Lactic acid fermentation",
        "Alcoholic fermentation",
        "Glycolysis alone",
        "Aerobic respiration",
      ],
      answerIndex: 3,
      explanation:
        "Aerobic respiration combines glycolysis, the Krebs cycle, and the electron transport chain, producing far more ATP than fermentation (page 3).",
    },
    {
      question:
        "What produces genetic variation during meiosis?",
      options: [
        "Crossing over and independent assortment",
        "Binary fission",
        "Cytokinesis alone",
        "DNA replication",
      ],
      answerIndex: 0,
      explanation:
        "Meiosis creates variation through crossing over and independent assortment before producing gametes (page 4).",
    },
  ],
};
