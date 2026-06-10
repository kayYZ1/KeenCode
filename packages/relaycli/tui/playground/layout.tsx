import { run } from "@/tui/render/index.ts";
import { Box, Text } from "@/tui/render/components.tsx";

function App() {
	return (
		<Box flex flexDirection="column" padding={1} gap={1}>
			{/* Flex Directions */}
			<Box border="single" borderLabel="Flex Directions" flexDirection="row" gap={1}>
				<Box flex border="round" borderLabel="row" flexDirection="row" padding={1} gap={1}>
					<Text color="red">A</Text>
					<Text color="green">B</Text>
					<Text color="blue">C</Text>
				</Box>
				<Box flex border="round" borderLabel="column" flexDirection="column" padding={1} gap={1}>
					<Text color="red">A</Text>
					<Text color="green">B</Text>
					<Text color="blue">C</Text>
				</Box>
			</Box>

			{/* Border Styles */}
			<Box border="single" borderLabel="Border Styles" flexDirection="row" gap={1} padding={1}>
				<Box flex border="single" borderLabel="single" padding={1}>
					<Text>single</Text>
				</Box>
				<Box flex border="double" borderLabel="double" padding={1}>
					<Text>double</Text>
				</Box>
				<Box flex border="round" borderLabel="round" padding={1}>
					<Text>round</Text>
				</Box>
				<Box flex border="bold" borderLabel="bold" padding={1}>
					<Text>bold</Text>
				</Box>
				<Box flex border="dash" borderLabel="dash" padding={1}>
					<Text>dash</Text>
				</Box>
				<Box flex border="block" borderLabel="block" padding={1}>
					<Text>block</Text>
				</Box>
			</Box>

			{/* Border Labels and Colors */}
			<Box flexDirection="row" gap={1}>
				<Box
					flex
					border="double"
					borderColor="magenta"
					borderLabel="Colored Border"
					borderLabelColor="cyan"
					padding={1}
				>
					<Text>borderColor + borderLabelColor</Text>
				</Box>
				<Box
					flex
					border="round"
					borderColor="yellow"
					borderLabel="Yellow Round"
					borderLabelColor="green"
					padding={1}
				>
					<Text>Custom label colors</Text>
				</Box>
			</Box>

			{/* Padding and Gap */}
			<Box border="single" borderLabel="Padding & Gap" flexDirection="row" gap={1} padding={1}>
				<Box flex border="round" borderLabel="pad=0 gap=0" flexDirection="row">
					<Text color="red">X</Text>
					<Text color="green">Y</Text>
					<Text color="blue">Z</Text>
				</Box>
				<Box flex border="round" borderLabel="pad=1 gap=0" flexDirection="row" padding={1}>
					<Text color="red">X</Text>
					<Text color="green">Y</Text>
					<Text color="blue">Z</Text>
				</Box>
				<Box flex border="round" borderLabel="pad=1 gap=2" flexDirection="row" padding={1} gap={2}>
					<Text color="red">X</Text>
					<Text color="green">Y</Text>
					<Text color="blue">Z</Text>
				</Box>
			</Box>

			{/* Justify Content */}
			<Box border="single" borderLabel="justifyContent" flexDirection="column" gap={1} padding={1}>
				<Box
					border="round"
					borderLabel="flex-start"
					flexDirection="row"
					justifyContent="flex-start"
					height={3}
					padding={1}
					gap={1}
				>
					<Text>A</Text>
					<Text>B</Text>
					<Text>C</Text>
				</Box>
				<Box
					border="round"
					borderLabel="center"
					flexDirection="row"
					justifyContent="center"
					height={3}
					padding={1}
					gap={1}
				>
					<Text>A</Text>
					<Text>B</Text>
					<Text>C</Text>
				</Box>
				<Box
					border="round"
					borderLabel="flex-end"
					flexDirection="row"
					justifyContent="flex-end"
					height={3}
					padding={1}
					gap={1}
				>
					<Text>A</Text>
					<Text>B</Text>
					<Text>C</Text>
				</Box>
				<Box
					border="round"
					borderLabel="space-between"
					flexDirection="row"
					justifyContent="space-between"
					height={3}
					padding={1}
					gap={1}
				>
					<Text>A</Text>
					<Text>B</Text>
					<Text>C</Text>
				</Box>
			</Box>

			{/* Align Items */}
			<Box border="single" borderLabel="alignItems" flexDirection="row" gap={1} padding={1}>
				<Box
					flex
					border="round"
					borderLabel="flex-start"
					flexDirection="row"
					alignItems="flex-start"
					height={5}
					padding={1}
					gap={1}
				>
					<Text color="red">Top</Text>
					<Text color="green">Top</Text>
				</Box>
				<Box
					flex
					border="round"
					borderLabel="center"
					flexDirection="row"
					alignItems="center"
					height={5}
					padding={1}
					gap={1}
				>
					<Text color="red">Mid</Text>
					<Text color="green">Mid</Text>
				</Box>
				<Box
					flex
					border="round"
					borderLabel="flex-end"
					flexDirection="row"
					alignItems="flex-end"
					height={5}
					padding={1}
					gap={1}
				>
					<Text color="red">Bot</Text>
					<Text color="green">Bot</Text>
				</Box>
			</Box>

			{/* Absolute Positioning + Background Colors */}
			<Box border="single" borderLabel="Absolute Position & bgColor" height={7} padding={1}>
				<Box bgColor="blue" width={20} height={3} padding={1}>
					<Text color="white" bold>Blue bg</Text>
				</Box>
				<Box bgColor="green" width={20} height={3} padding={1}>
					<Text color="black" bold>Green bg</Text>
				</Box>
				<Box
					position="absolute"
					top={1}
					right={2}
					border="double"
					borderColor="red"
					bgColor="yellow"
					padding={1}
				>
					<Text color="black" bold>Overlay!</Text>
				</Box>
			</Box>

			{/* Footer */}
			<Box>
				<Text color="gray" italic>Press Ctrl+C to exit</Text>
			</Box>
		</Box>
	);
}

run(() => <App />);
