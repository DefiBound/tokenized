import './styles.css';
import React, { useState, useEffect } from 'react';
import { useSignAndExecuteTransactionBlock, useSuiClient } from '@mysten/dapp-kit';
import { useCurrentAccount } from "@mysten/dapp-kit";
import * as Form from '@radix-ui/react-form';
import { module_prefix, initialBase64, constants_alias } from './Constants';
import { publishModuleTxb,CompiledModule, TemplateDynamicContent, DynamicTemplateField, ConstantReplacement } from './lib';


function formatModuleName(tokenizedObject: string): string {
    return `${module_prefix}${tokenizedObject.replace(/^0x/, '')}`;
}
function formatTokenized(moduleName: string): string {
    const regex = new RegExp(`^${module_prefix}`);
    return moduleName.replace(regex, '');
}
export function TemplateEditor({ tokenized_object }: { tokenized_object: string }) {
    const suiClient = useSuiClient();
    const { mutate: signAndExecute } = useSignAndExecuteTransactionBlock();
    const account = useCurrentAccount();

    const [base64, setBase64] = useState(initialBase64);
    const [compiledModule, setCompiledModule] = useState<CompiledModule | null>(null);
    const [constants, setConstants] = useState<ConstantReplacement<DynamicTemplateField>[]>([]);
    const [identifiers, setIdentifiers] = useState<Record<string, string>>({});
    const [moduleName, setModuleName] = useState("template");

    useEffect(() => {
        const formattedValue = formatModuleName(tokenized_object);
        setModuleName(formattedValue);

        if (compiledModule) {
            const newConstants = constants.map(constant => {
                let newValue = constant.newValue;
                if (constant.alias === "LOCKED_OBJECT") {
                    newValue = formatTokenized(formattedValue);
                }
                return { ...constant, newValue };
            });
            setConstants(newConstants);
        }
    }, [tokenized_object, compiledModule]);

    const handleBase64Change = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setBase64(e.target.value);
    };

    const handleConstantChange = (index: number, field: string, value: string) => {
        const newConstants = [...constants];
        newConstants[index] = { ...newConstants[index], [field]: value };
        setConstants(newConstants);
    };

    // const handleIdentifierChange = (key: string, value: string) => {
    //     setIdentifiers({ ...identifiers, [key]: value });
    // };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!compiledModule) return;
        try {
            const content: TemplateDynamicContent<DynamicTemplateField> = { constants, identifiers };
            console.log(content);
            compiledModule.replaceConstantsAndIdentifiers(moduleName, content);
            console.log(compiledModule.inner)
            const updatedBytecode = compiledModule.byte_code;
            const txb = publishModuleTxb(updatedBytecode, compiledModule.inner.identifiers, account?.address as string);

            signAndExecute(
                {
                    transactionBlock: txb,
                },
                {
                    onSuccess: (tx) => {
                        suiClient.waitForTransactionBlock({ digest: tx.digest,options:{
                            showBalanceChanges: true,
                            showEffects: true,
                            showEvents: true,
                            showObjectChanges: true,
                            showInput: true,
                        } }).then((resp) => {
                            console.log("New Wrapper Token published! Digest:", tx.digest);
                            console.log("New Wrapper Token published! TX:", resp);
                            const packageId = resp.effects?.created?.find(
                                (item) => item.owner === "Immutable"
                            )?.reference.objectId;
                            console.log("Package ID:", packageId);
                        });
                    },
                    onError: (e) => {
                        alert("Sign Tx Failed!\nPlease Check Network And Wrapper Need Tokenized Object");
                        console.log(e);
                    }
                },
            );
            alert("Publisher Tx Successful! Please Sign And Waiting For Tx Confirmed.");
        } catch (error) {
            console.error("Error during publishing:", error);
            alert("Publisher Tx Failed");
        }
    };

    const compileBase64 = () => {
        try {
            const module = new CompiledModule("template", base64);
            setCompiledModule(module);
            const newConstants = module.getReplaceableConstants().map(field => {
                const alias = constants_alias.find(c => c.name === field.name)?.alias || "";
                return {
                    name: field.name,
                    alias: alias,
                    newValue: field.currentValue,
                    expectedValue: field.currentValue,
                    expectedType: field.expectedType
                };
            });
            setConstants(newConstants);
            setIdentifiers(module.inner.identifiers.reduce((acc, id) => {
                acc[id] = id;
                return acc;
            }, {} as Record<string, string>));
        } catch (error) {
            console.error("Error deserializing module:", error);
            setCompiledModule(null);
        }
    };

    return (
        <Form.Root className="FormRoot" onSubmit={handleSubmit}>
            <Form.Field className="FormField" name="base64">
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <Form.Label className="FormLabel">Base64</Form.Label>
                </div>
                <Form.Control asChild>
                    <textarea className="Textarea" value={base64} onChange={handleBase64Change} required />
                </Form.Control>
            </Form.Field>
            <button type="button" onClick={compileBase64} className="Button" style={{ marginTop: 10 }}>
                Compile
            </button>
            <Form.Field className="FormField" name="moduleName">
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <Form.Label className="FormLabel">Module Name</Form.Label>
                </div>
                <Form.Control asChild>
                    <input className="Input" type="text" value={formatModuleName(tokenized_object)} onChange={(e) => setModuleName(e.target.value)} required />
                </Form.Control>
            </Form.Field>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ width: '45%', maxHeight: 400, overflowY: 'scroll', border: '1px solid #ccc', padding: 10 }}>
                    <pre>{compiledModule ? JSON.stringify(compiledModule.inner, null, 2) : "Invalid Base64"}</pre>
                </div>
                <div style={{ width: '45%' }}>
                    <h2>Constants</h2>
                    {constants
                        .filter(constant => constants_alias.some(c => c.alias === constant.alias))
                        .map((constant, index) => (
                            <Form.Field key={index} className="FormField ConstantField" name={`constant_${index}`}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <Form.Label className="FormLabel">{constant.alias}</Form.Label>
                                    <span className="FormType" style={{ marginLeft: 10 }}>{constant.expectedType}</span>
                                    <Form.Control asChild>
                                        <input
                                            className="Input"
                                            type="text"
                                            value={constant.newValue}
                                            onChange={(e) => handleConstantChange(index, 'newValue', e.target.value)}
                                            placeholder={constant.expectedValue}
                                            style={{ marginLeft: 10 }}
                                        />
                                    </Form.Control>
                                </div>
                            </Form.Field>
                        ))}
                    {/* <h2>Identifiers</h2>
                    {Object.keys(identifiers).map((key) => (
                        <Form.Field key={key} className="FormField IdentifierField" name={key}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <Form.Label className="FormLabel">{key}</Form.Label>
                                <Form.Control asChild>
                                    <input
                                        className="Input"
                                        type="text"
                                        value={identifiers[key]}
                                        onChange={(e) => handleIdentifierChange(key, e.target.value)}
                                        required
                                        style={{ marginLeft: 10 }}
                                    />
                                </Form.Control>
                            </div>
                        </Form.Field>
                    ))} */}
                </div>
            </div>
            <Form.Submit asChild>
                <button className="Button" style={{ marginTop: 10 }}>
                    Publish
                </button>
            </Form.Submit>
        </Form.Root>
    );
};
