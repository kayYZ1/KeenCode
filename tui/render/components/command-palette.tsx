import { Box, Text, TextInput } from "../components.tsx";
import type { CommandPaletteItem } from "../hooks/command-palette.ts";
import type { useCommandPalette } from "../hooks/command-palette.ts";

export interface CommandPaletteProps {
	palette: ReturnType<typeof useCommandPalette>;
	width?: number;
	placeholder?: string;
	borderLabel?: string;
	bgColor?: string;
}

export function CommandPalette(props: CommandPaletteProps) {
	const { palette, width = 60, placeholder = "Type a command...", borderLabel = "Commands", bgColor = "#181825" } =
		props;

	if (!palette.open.value) return <Box />;

	return (
		<Box position="absolute" top={0} left={0} right={0} bottom={0} justifyContent="center" alignItems="center">
			<Box
				width={width}
				border="round"
				borderColor="white"
				borderLabel={borderLabel}
				borderLabelColor="white"
				bgColor={bgColor}
				flexDirection="column"
				padding={1}
				gap={1}
			>
				<TextInput
					value={palette.query.value}
					cursorPosition={palette.cursor.value}
					placeholder={placeholder}
					placeholderColor="gray"
					bgColor={bgColor}
					focused
					width={width - 4}
				/>
				<Box flexDirection="column">
					{palette.matches.map((item: CommandPaletteItem, i: number) => {
						const isSelected = i === palette.selectedIndex.value;
						return (
							<Box key={item.id} flexDirection="row" gap={1}>
								<Text color={isSelected ? "cyan" : "gray"} bgColor={bgColor} bold={isSelected}>
									{isSelected ? ">" : " "}
								</Text>
								<Text color={isSelected ? "white" : "gray"} bgColor={bgColor} bold={isSelected}>
									{item.title}
								</Text>
								{item.description && (
									<Text color="gray" bgColor={bgColor} italic>
										{item.description}
									</Text>
								)}
							</Box>
						);
					})}
					{palette.matches.length === 0 && (
						<Text color="gray" bgColor={bgColor} italic>
							No matching commands
						</Text>
					)}
				</Box>
			</Box>
		</Box>
	);
}
