// Match the supported engine before installing or building.
export function checkNode(version = process.versions.node) {
  const [major, minor] = version.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 12)) {
    throw new Error(`This project requires Node 22.12 or newer; current Node is ${version}. Select Node 22+ for this terminal, then retry.`);
  }
}
checkNode();
