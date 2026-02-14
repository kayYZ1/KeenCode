import { run } from "@/tui/render/index.ts";
import { Box, Spinner, Text } from "@/tui/render/components.tsx";
import { initDevTools } from "@/tui/dev/index.ts";

function App() {
	return (
		<Box flex flexDirection="column" padding={1} gap={1}>
			<Box border="single" borderLabel="Different Colors" flexDirection="row" gap={2} padding={1}>
				<Spinner color="red" />
				<Spinner color="green" />
				<Spinner color="blue" />
				<Spinner color="cyan" />
				<Spinner color="magenta" />
				<Spinner color="yellow" />
			</Box>

			<Box border="single" borderLabel="Different Speeds" flexDirection="row" gap={3} padding={1}>
				<Box flexDirection="row" gap={1}>
					<Spinner interval={40} />
					<Text>Fast (40ms)</Text>
				</Box>
				<Box flexDirection="row" gap={1}>
					<Spinner />
					<Text>Normal (80ms)</Text>
				</Box>
				<Box flexDirection="row" gap={1}>
					<Spinner interval={200} />
					<Text>Slow (200ms)</Text>
				</Box>
			</Box>

			<Box border="single" borderLabel="Spinner with Text" flexDirection="column" gap={1} padding={1}>
				<Box flexDirection="row" gap={1}>
					<Spinner color="cyan" />
					<Text>Loading...</Text>
				</Box>
				<Box flexDirection="row" gap={1}>
					<Spinner color="magenta" />
					<Text>Processing...</Text>
				</Box>
			</Box>

			<Box border="single" borderLabel="Spinner in a Bordered Box" padding={1}>
				<Box border="round" padding={1}>
					<Spinner color="green" />
				</Box>
			</Box>

			<Box>
				<Text color="gray" italic>
					Press Ctrl+C to exit
				</Text>
			</Box>
		</Box>
	);
}

initDevTools();
run(() => <App />);
