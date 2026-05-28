#!/usr/bin/env bun
import {Command} from "commander";
import { runWakeup } from "./tui/wakeup";

const program = new Command();

program.name("olly").description("Meet Olly, your AI assistant for code generation and debugging.").version("1.0.0");

program.command("wakeup").description("Wake up Olly and start the assistant.").action(async () => {
  await runWakeup();
});

await program.parseAsync(process.argv);