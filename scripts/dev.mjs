import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? process.env.ComSpec ?? "cmd.exe" : "npm";
const spawnOptions = { stdio: "inherit", shell: false };

function npmArgs(script) {
  return isWindows ? ["/d", "/s", "/c", `npm run ${script}`] : ["run", script];
}

const processes = [
  spawn(npmCommand, npmArgs("dev:api"), spawnOptions),
  spawn(npmCommand, npmArgs("dev:web"), spawnOptions)
];

function stopAll(signal = "SIGTERM") {
  for (const child of processes) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

for (const child of processes) {
  child.on("exit", (code) => {
    if (code && code !== 0) {
      stopAll();
      process.exitCode = code;
    }
  });
}

process.on("SIGINT", () => {
  stopAll("SIGINT");
});

process.on("SIGTERM", () => {
  stopAll("SIGTERM");
});

