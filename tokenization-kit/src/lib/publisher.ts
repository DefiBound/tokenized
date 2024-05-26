// @ts-ignore
import type { SuiClient } from '@mysten/sui.js/client';
import { CompiledModule, TemplateDynamicContent,DynamicTemplateField } from './compiled-module';

// @ts-ignore
import { TransactionBlock } from "@mysten/sui.js/transactions";
// @ts-ignore
import { normalizeSuiObjectId } from "@mysten/sui.js/utils";

export const publishModuleTxb = (
    updatedBytecode: Uint8Array,
    dependencies: string[],
    signerAddress:string  // 签名者对象
):TransactionBlock => {
    console.log("Publishing module with dependencies:", dependencies);
    console.log("Publishing module with updatedBytecode:", updatedBytecode);
    console.log("Publishing module with signerAddress:", signerAddress);
    const tx = new TransactionBlock();
    tx.setGasBudget(100000000);
    const normalizedDependencies = dependencies.map(dep => normalizeSuiObjectId(dep));
    const [upgradeCap] = tx.publish({
        modules: [
            [...updatedBytecode]
        ],
        dependencies: normalizedDependencies,
        
    });
    tx.transferObjects([upgradeCap], tx.pure(signerAddress, "address"));
    return tx
};

export const WrapperTokenPublisher = async<T extends DynamicTemplateField>(
    client: SuiClient, // SuiClient 类型
    templeteModule: string, // 模板 module 名称
    templateBase64g: string, // 模板 base64 字符串
    module: string, // 模块名称
    content: TemplateDynamicContent<T>, // 模板待替换内容
    signer: any // 签名者对象
) => {
    try {
        // 创建 CompiledModule 实例
        const compiledModule = new CompiledModule(templeteModule, templateBase64g);

        // 替换常量和标识符
        compiledModule.replaceConstantsAndIdentifiers(module, content);

        // 序列化更新后的模块
        const updatedBytecode = compiledModule.toBytecode();
        console.log("Updated Bytecode:", updatedBytecode);

        // 发布更新后的模块
        const txb  = publishModuleTxb(updatedBytecode,compiledModule.inner.identifiers,signer.getPublicKey().toSuiAddress());
        const txRes = await client.signAndExecuteTransactionBlock({
            transactionBlock: txb,
            signer,
            requestType: "WaitForLocalExecution",
            options: {
                showEvents: true,
                showEffects: true,
                showObjectChanges: true,
                showBalanceChanges: true,
                showInput: true,
            },
        });

        if (txRes?.effects?.status.status === "success") {
            console.log("New asset published! Digest:", txRes.digest);
            const packageId = txRes.effects.created?.find(
                // @ts-ignore
                (item) => item.owner === "Immutable"
            )?.reference.objectId;
            console.log("Package ID:", packageId);
        } else {
            console.log("Error:", txRes?.effects?.status);
            throw new Error("Publishing failed");
        }

    } catch (error) {
        console.error("Error during publishing:", error);
    }
};