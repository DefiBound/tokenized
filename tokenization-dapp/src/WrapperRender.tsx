import { Box, Card, Flex, Text } from '@radix-ui/themes';

export function WrapperRender({ id }: { id: string }) {
    return (
        <Card style={{ maxWidth: 240, maxHeight: 80 }}>
            <Flex gap="3" align="center">
                <Box>
                    <Text as="div" size="2" weight="bold">
                        id:{id}
                    </Text>
                </Box>
            </Flex>
        </Card>
    );
}