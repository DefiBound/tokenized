import '@radix-ui/themes/styles.css';
import { Theme, Flex, Heading, Container, Button, Grid, Box, Select } from '@radix-ui/themes'
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransactionBlock, useSuiClient, useSuiClientQuery } from '@mysten/dapp-kit';
import { useMemo, useState } from 'react';
import { PACKAGE_ID } from './Constants';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { TemplateEditor } from './Template';
import { WrapperRender } from './WrapperRender';





export function MintWrapper(props: { onCreated: (wrappers: string[]) => void }) {
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransactionBlock();
  return (
    <Button
      onClick={() => {
        mint();
      }}
    >Mint GameNFT
    </Button>

  );
  function mint() {
    const txb = new TransactionBlock();
    txb.moveCall({
      arguments: [],
      target: `${PACKAGE_ID}::entry::empty`,
    });

    signAndExecute(
      {
        transactionBlock: txb,
        options: {
          showEffects: true,
        },
      },
      {
        onSuccess: (tx) => {
          suiClient
            .waitForTransactionBlock({
              digest: tx.digest,
            })
            .then(() => {
              const objectId = tx.effects?.created?.[0]?.reference?.objectId;
              if (objectId) {
                props.onCreated([objectId]);
              }
            });
        },
        onError: (e) => {
          alert("警告！\n检查defaultNetwork和PACKAGE_ID");
          console.log(e);
        }
      },
    );
  }
}

export default function App() {
  const account = useCurrentAccount();
  const { data, isPending, error } = useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: account?.address as string,
      options: {
        showType: true,
      },
      filter: {
        MatchAll: [
          {
            StructType: `${PACKAGE_ID}::wrapper::Wrapper`,
          },
        ]
      }
    },
    {
      enabled: !!account,
    }
  );
  const [wrappers, setWrappers] = useState<string[]>([]);
  const [wrapper, setWrapper] = useState<string>("");
  useMemo(() => {
    if (!account || error || isPending || !data) {
      return;
    }
    setWrappers(data.data.map((object) => object.data?.objectId as string));
    return;
  }, [account, data, error, isPending]);


  return (
    <Theme>
      <Flex justify="between" align={"center"} style={{ minHeight: 65, maxHeight: 65 }} >
        <Heading color="cyan">Wrapper Tokenization Publish Dapp</Heading>
        <MintWrapper
          onCreated={(ws) => {
            setWrappers(wrappers.concat(ws));
          }}
        />
        {
          !account ? (
            <div>please connect first</div>
          ) : (
            <Select.Root onValueChange={(value) => {
              setWrapper(value);
            }}>
              <Select.Trigger style={{ minHeight: 65 }} />
              <Select.Content>
                {
                  wrappers.map((wrapper) => {
                    return (
                      <Select.Item key={wrapper} value={wrapper} style={{ height: "70px", width: "235px" }}>
                        <WrapperRender id={wrapper} />
                      </Select.Item>
                    )
                  })
                }
              </Select.Content>
            </Select.Root>
          )
        }
        <ConnectButton />
      </Flex>

      <Container>
        <TemplateEditor tokenized_object={wrapper} />
      </Container>
    </Theme >
  )
}