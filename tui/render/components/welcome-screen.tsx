import { Box, Text } from "../components.tsx";
import { useSignal, useSignalEffect } from "../hooks/signals.ts";

// Spaces use \u00A0 (non-breaking space) so wrapText doesn't collapse them
const LOGO_LINES = [
	"██╗  ██╗███████╗███████╗███╗   ██╗ ██████╗ ██████╗ ██████╗ ███████╗",
	"██║ ██╔╝██╔════╝██╔════╝████╗  ██║██╔════╝██╔═══██╗██╔══██╗██╔════╝",
	"█████╔╝ █████╗  █████╗  ██╔██╗ ██║██║     ██║   ██║██║  ██║█████╗",
	"██╔═██╗ ██╔══╝  ██╔══╝  ██║╚██╗██║██║     ██║   ██║██║  ██║██╔══╝",
	"██║  ██╗███████╗███████╗██║ ╚████║╚██████╗╚██████╔╝██████╔╝███████╗",
	"╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝",
].map((line) => line.replace(/ /g, "\u00A0"));

type RGB = [number, number, number];

function buildGradient(stops: RGB[], stepsPerSegment: number): string[] {
	const colors: string[] = [];
	for (let s = 0; s < stops.length; s++) {
		const from = stops[s];
		const to = stops[(s + 1) % stops.length];
		for (let i = 0; i < stepsPerSegment; i++) {
			const t = i / stepsPerSegment;
			const r = Math.round(from[0] + (to[0] - from[0]) * t);
			const g = Math.round(from[1] + (to[1] - from[1]) * t);
			const b = Math.round(from[2] + (to[2] - from[2]) * t);
			colors.push(
				`#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${
					b.toString(16).padStart(2, "0")
				}`,
			);
		}
	}
	return colors;
}

// cyan → blue → magenta → blue (loops back to cyan)
const GRADIENT = buildGradient([[0, 220, 255], [60, 100, 255], [200, 80, 255], [60, 100, 255]], 12);

export interface WelcomeScreenProps {
	version: string;
	subtitle?: string;
}

export function WelcomeScreen({ version, subtitle = "Type a message to get started" }: WelcomeScreenProps) {
	const frame = useSignal(0);

	useSignalEffect(() => {
		const timer = setInterval(() => {
			frame.value = (frame.value + 1) % GRADIENT.length;
		}, 80);
		return () => clearInterval(timer);
	});

	return (
		<Box flex flexDirection="column" justifyContent="center" alignItems="center" gap={1}>
			<Box flexDirection="column">
				{LOGO_LINES.map((line, i) => (
					<Text key={i} color={GRADIENT[(frame.value + i * 4) % GRADIENT.length]}>{line}</Text>
				))}
			</Box>
			<Box flexDirection="column" alignItems="center" gap={1}>
				<Text color="gray">v{version} — terminal coding agent</Text>
				<Text color="gray" italic>{subtitle}</Text>
			</Box>
		</Box>
	);
}
