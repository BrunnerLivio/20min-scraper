import chalk from "chalk";
import { formatDistance } from "date-fns";

export const log = (message: string) =>
  console.log(`[${chalk.magenta(new Date().toISOString())}] ${message}`);

export const createLogTimer = (startMessage: string) => {
  log(`┌── ${startMessage}`);
  const start = new Date();

  const end = () => {
    const end = new Date();

    const duration = formatDistance(start, end, {
      includeSeconds: true,
    });

    log(
      `└── ${chalk.green("✅ Finished")}: ${startMessage} [${chalk.blue(
        "Δ " + duration
      )}]`
    );
  };

  const step = (message: string, percentage: number) => {
    log(
      `├── ${chalk.blue(
        "🕞 Step [" + Math.round(percentage) + "%]"
      )}: ${message}`
    );
  };

  const error = (message: string) => {
    log(`├── ${chalk.red("❌ Error")}: ${message}`);
  };

  return { end, step, error };
};
