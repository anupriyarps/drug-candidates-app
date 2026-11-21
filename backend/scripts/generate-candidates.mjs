
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TOTAL_RECORDS = 100_000;

const statuses = [
  "In Development",
  "Clinical Trial",
  "Approved",
];

const templates = [
  {
    name: "NovaCure",
    description:
      "An illustrative candidate for a fictional inflammatory condition.",
    mechanismOfAction:
      "Illustrative inhibition of a fictional inflammatory signaling pathway.",
    sideEffects: ["Mild headache", "Nausea", "Fatigue"],
  },
  {
    name: "CardioZen",
    description:
      "An illustrative candidate for a fictional cardiovascular condition.",
    mechanismOfAction:
      "Illustrative modulation of a fictional cardiovascular receptor.",
    sideEffects: ["Dizziness", "Nausea"],
  },
  {
    name: "Immunexa",
    description:
      "An illustrative candidate for a fictional immune-related condition.",
    mechanismOfAction:
      "Illustrative modulation of a fictional immune response pathway.",
    sideEffects: ["Fatigue", "Mild skin irritation"],
  },
  {
    name: "NeuroVale",
    description:
      "An illustrative candidate for a fictional neurological condition.",
    mechanismOfAction:
      "Illustrative interaction with a fictional neural signaling target.",
    sideEffects: ["Drowsiness", "Headache"],
  },
];

function generateCandidate(index) {
  const template = templates[index % templates.length];

  return {
    id: `drug-${String(index + 1).padStart(6, "0")}`,
    name: `${template.name}-${String(index + 1).padStart(6, "0")}`,
    status: statuses[index % statuses.length],
    description: template.description,
    mechanismOfAction: template.mechanismOfAction,
    sideEffects: [...template.sideEffects],
  };
}

async function generateDataset() {
  console.log(`Generating ${TOTAL_RECORDS.toLocaleString()} candidates...`);

  const candidates = Array.from(
    { length: TOTAL_RECORDS },
    (_, index) => generateCandidate(index),
  );

  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const outputDirectory = join(scriptDirectory, "..", "data");
  const outputFile = join(outputDirectory, "candidates.large.json");

  await mkdir(outputDirectory, { recursive: true });

  await writeFile(
    outputFile,
    JSON.stringify(candidates),
    "utf8",
  );

  console.log("Dataset generated successfully.");
  console.log(`Records: ${candidates.length.toLocaleString()}`);
  console.log(`Output: ${outputFile}`);
}

generateDataset().catch((error) => {
  console.error("Dataset generation failed:", error);
  process.exitCode = 1;
});
