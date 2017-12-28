/**
 * This file has code that is shared for all the ignore options.
 */

import * as ts from "typescript";
import * as Lint from "tslint";
import * as Walk from "./walk";

const OPTION_IGNORE_LOCAL = "ignore-local";
const OPTION_IGNORE_CLASS = "ignore-class";
const OPTION_IGNORE_INTERFACE = "ignore-interface";
const OPTION_IGNORE_PREFIX = "ignore-prefix";

export interface Options {
  readonly ignoreLocal: boolean;
  readonly ignoreClass: boolean;
  readonly ignoreInterface: boolean;
  readonly ignorePrefix: string | undefined;
}

//tslint:disable-next-line
export function parseOptions(options: any[]): Options {
  const ignoreLocal = options.indexOf(OPTION_IGNORE_LOCAL) !== -1;
  const ignoreClass = options.indexOf(OPTION_IGNORE_CLASS) !== -1;
  const ignoreInterface = options.indexOf(OPTION_IGNORE_INTERFACE) !== -1;
  let ignorePrefix: string | undefined;
  for (const o of options) {
    //tslint:disable-next-line
    if (typeof o === "object" && o[OPTION_IGNORE_PREFIX] !== null) {
      //tslint:disable-line
      ignorePrefix = o[OPTION_IGNORE_PREFIX];
      break;
    }
  }
  return { ignoreLocal, ignoreClass, ignoreInterface, ignorePrefix };
}

export function checkNodeWithIgnore(
  checkNode: Walk.CheckNodeFunction<Options>
): Walk.CheckNodeFunction<Options> {
  return (node: ts.Node, ctx: Lint.WalkContext<Options>) => {
    // Skip checking in functions if ignore-local is set
    if (
      ctx.options.ignoreLocal &&
      (node.kind === ts.SyntaxKind.FunctionDeclaration ||
        node.kind === ts.SyntaxKind.ArrowFunction ||
        node.kind === ts.SyntaxKind.FunctionExpression ||
        node.kind === ts.SyntaxKind.MethodDeclaration)
    ) {
      // We still need to check the parameters and return type
      const functionNode:
        | ts.FunctionDeclaration
        | ts.ArrowFunction
        | ts.MethodDeclaration = node as any; //tslint:disable-line
      const invalidNodes = checkIgnoreLocalFunctionNode(
        functionNode,
        ctx,
        checkNode
      );
      // Now skip this whole branch
      return { invalidNodes, skipBranch: true };
    }

    // Skip checking in classes/interfaces if ignore-class/ignore-interface is set
    if (
      (ctx.options.ignoreClass &&
        node.kind === ts.SyntaxKind.PropertyDeclaration) ||
      (ctx.options.ignoreInterface &&
        node.kind === ts.SyntaxKind.PropertySignature)
    ) {
      // Now skip this whole branch
      return { invalidNodes: [], skipBranch: true };
    }

    // Forward to check node
    return checkNode(node, ctx);
  };
}

function checkIgnoreLocalFunctionNode(
  functionNode:
    | ts.FunctionDeclaration
    | ts.ArrowFunction
    | ts.MethodDeclaration,
  ctx: Lint.WalkContext<Options>,
  checkNode: Walk.CheckNodeFunction<Options>
): ReadonlyArray<Walk.InvalidNode> {
  let myInvalidNodes: Array<Walk.InvalidNode> = [];

  // Check either the parameter's explicit type if it has one, or itself for implict type
  for (const n of functionNode.parameters.map(p => (p.type ? p.type : p))) {
    const { invalidNodes: invalidCheckNodes } = checkNode(n, ctx);
    if (invalidCheckNodes) {
      myInvalidNodes = myInvalidNodes.concat(...invalidCheckNodes);
    }
  }

  // Check the return type
  if (functionNode.type) {
    const { invalidNodes: invalidCheckNodes } = checkNode(
      functionNode.type,
      ctx
    );
    if (invalidCheckNodes) {
      myInvalidNodes = myInvalidNodes.concat(...invalidCheckNodes);
    }
  }

  return myInvalidNodes;
}

export function shouldIgnorePrefix(
  node: ts.Node,
  options: Options,
  sourceFile: ts.SourceFile
): boolean {
  // Check ignore-prefix for VariableDeclaration, PropertySignature, TypeAliasDeclaration, Parameter
  if (options.ignorePrefix) {
    if (
      node &&
      (node.kind === ts.SyntaxKind.VariableDeclaration ||
        node.kind === ts.SyntaxKind.Parameter ||
        node.kind === ts.SyntaxKind.PropertySignature ||
        node.kind === ts.SyntaxKind.PropertyDeclaration ||
        node.kind === ts.SyntaxKind.TypeAliasDeclaration)
    ) {
      const variableDeclarationNode = node as
        | ts.VariableDeclaration
        | ts.PropertySignature
        | ts.TypeAliasDeclaration
        | ts.ParameterDeclaration;
      if (
        variableDeclarationNode.name
          .getText(sourceFile)
          .substr(0, options.ignorePrefix.length) === options.ignorePrefix
      ) {
        return true;
      }
    }
  }
  return false;
}