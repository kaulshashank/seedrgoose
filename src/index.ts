import type { Document, Model, HydratedDocument, ObjectId } from "mongoose";

type Method<T> = (...childStates: State<T>[]) => State<T>;

interface Ref {
    model: Model<any>;
    keys: Array<{
        key: string | string[];
        model: Model<any>;
    }>;
}

type Refs = Ref[];

export interface State<T> {
    _model: Model<T>;
    collection: string;
    children: State<T>[];
    refs: Refs;
    patches: Record<string, any>;
}

export interface StateWithDoc<T> extends State<T> {
    _doc: HydratedDocument<T>;
    children: StateWithDoc<T>[]
}

export function model<T>(model: Model<T>, refs: Refs = []): Method<T> {

    function method(...childStates: State<T>[]): State<T> {

        const state: State<T> = {
            _model: model,
            collection: model.collection.name,
            children: [],
            refs,
            patches: {}
        };

        state.children.push(...childStates);

        return state;
    };

    return method;
}

export async function seed<T>(topLevelState: State<T>): Promise<StateWithDoc<T>> {

    const {
        refs
    } = topLevelState;

    function applyPatches<T>(state: StateWithDoc<T>): StateWithDoc<T> {
        const document = state._doc;
        for (const path in state.patches) {
            const value = state.patches[path];
            document.set(path, value);
        }
        return state;
    }

    function createStateWithDocs(baseState: State<T>): StateWithDoc<T> {
        const _doc = new baseState._model();

        const state: StateWithDoc<T> = {
            _model: baseState._model,
            collection: baseState.collection,
            refs: baseState.refs,
            patches: baseState.patches,
            children: [],
            _doc
        };

        if (baseState.children && baseState.children.length) {
            state.children = baseState.children.map(state => createStateWithDocs(state));
        }

        applyPatches(state);

        return state;
    }

    function assignRef(doc: Document, key: string | string[], ref: ObjectId) {
        const isArrayOfRefs = Array.isArray(key);
        const field = isArrayOfRefs ? key[0] : key;
        if (isArrayOfRefs && doc.get(field) && Array.isArray(doc.get(field))) {
            if (field.includes(".")) {
                const segments = field.split(".");
                const path = segments.reduce(
                    (str, segment) => (str + (doc.get(str) && Array.isArray(doc.get(str))
                        ? ("." + doc.get(str).length) + "." + segment
                        : segment)
                    )
                    , ""
                );
                doc.set(path, ref);
            } else {
                const path = field + "." + doc.get(field).length;
                doc.set(path, ref);
            }
        } else {
            doc.set(field, ref);
        }
    }

    function populateRefs(baseState: StateWithDoc<T>): void {
        if (refs.length) {
            function populateRefsForChildren(children: StateWithDoc<T>[]) {
                for (const childState of children) {
                    const assignChildIdToDoc = (key: string | string[]) => assignRef(baseState._doc, key, childState._doc._id);
                    const assignDocIdToChild = (key: string | string[]) => assignRef(childState._doc, key, baseState._doc._id);

                    const currentRef = refs.find(ref => ref.model === baseState._model);
                    if (currentRef && currentRef.keys && currentRef.keys.length && childState._doc._id) {
                        for (const key of currentRef.keys) {
                            if (key.model === childState._model) {
                                assignChildIdToDoc(key.key);
                            }
                        }
                    }

                    const childRefs = refs.filter(ref => ref.keys.some(key => key.model === baseState._model));
                    if (baseState._doc && baseState._doc._id) {
                        for (const ref of childRefs) {
                            for (const key of ref.keys) {
                                if (key.model === baseState._model) {
                                    assignDocIdToChild(key.key);
                                }
                            }
                        }
                    }

                    populateRefsForChildren(childState.children);
                }
            }

            if (baseState.children && baseState.children.length) {
                populateRefsForChildren(baseState.children);

                for (const childState of baseState.children) {
                    populateRefs(childState);
                }
            }
        }
    }

    async function saveTree(baseState: StateWithDoc<T>): Promise<void> {
        await Promise.all([
            baseState._doc.save(),
            ...baseState.children.map(childState => saveTree(childState))
        ]);
    }

    const state = createStateWithDocs(topLevelState);

    populateRefs(state);

    await saveTree(state);

    return state;
}

export function patch<T>(state: State<T>, patches: Record<string, any>): State<T> {
    state.patches = patches;
    return state;
}

export async function cleanup<T>(stateTree: StateWithDoc<T>): Promise<void> {
    await Promise.all([
        stateTree._doc.delete(),
        ...stateTree.children.map(child => cleanup(child))
    ]);
}
