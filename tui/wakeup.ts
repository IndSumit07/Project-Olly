import {select, isCancel} from "@clack/prompts";
import chalk from "chalk";
import figlet from "figlet";
import { runCliMode } from "../modes/cli";

const BANNER_FONT = 'ANSI Shadow';
const SHADOW = chalk.hex('#ff0000');
const FACE = chalk.hex('#e8dcf8');

function printBannerWithShadow(ascii: string) {
    const bannerLines = ascii.replace(/\s+$/, '').split('\n');
    const maxLen = Math.max(...bannerLines.map((line) => line.length), 0);
    const rowWidth = maxLen + 2;

    for (const line of bannerLines) {
        console.log(SHADOW(('  ' + line).padEnd(rowWidth)));
    }

    process.stdout.write(`\x1b[${bannerLines.length}A`);

    for (const line of bannerLines) {
        console.log(FACE(line.padEnd(rowWidth)));
    }

    console.log();
}

export async function runWakeup() {
    let ascii:string;

    try{
        ascii = figlet.textSync('Olly', {font: BANNER_FONT});
    } catch (error) {
        ascii = figlet.textSync('Olly', {font: 'Standard'});
    }
    printBannerWithShadow(ascii);

    while (true) {
        const mode  = await select({
            message: "How would you like to interact with Olly?",
            options: [
                { value: "cli", label: "CLI" },
                { value: "telegram", label: "Telegram" },
                { value: "exit", label: "Exit" }
            ]
        });

        if (isCancel(mode) || mode === "exit") {
            console.log(chalk.yellow("\n No worries! You can wake up Olly anytime by running 'olly wakeup'."));
            return;
        }

        if(mode === "cli") {
            await runCliMode();
            continue;
        }

        if(mode === "telegram") {
            console.log(chalk.dim("Awesome! Starting Olly in Telegram mode..."));
            // Here you would initialize your Telegram bot interface for Olly
        }
    }
}