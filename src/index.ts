import mongoose from "mongoose";

export interface State<T> {
    _model: mongoose.Model<T>;
    _doc: mongoose.HydratedDocument<T>;
    collection: string;
    children: State<T>[];
}

type Method<T> = (...childStates: State<T>[]) => State<T>;
interface Ref {
    model: mongoose.Model<any>;
    keys: Array<{
        key: string | string[];
        model: mongoose.Model<any>;
    }>;
}
type Refs = Ref[];

export function model<T>(model: mongoose.Model<T>, refs: Refs = []): Method<T> {

    function assignRef(doc: mongoose.Document, key: string | string[], ref: mongoose.Types.ObjectId) {
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

    function method(...childStates: State<T>[]) {
        const doc = new model();

        const state: State<T> = {
            _model: model,
            _doc: doc,
            collection: doc.collection.name,
            children: []
        };

        function populateChildren(children: State<T>[]) {

            return children.reduce<State<T>[]>((children, childState) => {

                const assignStateRef = (key: string | string[]) => assignRef(state._doc, key, childState._doc._id);
                const assignDocIdToChild = (key: string | string[]) => assignRef(childState._doc, key, state._doc._id);

                if (refs.length) {
                    const currentRef = refs.find(ref => ref.model === state._model);
                    if (currentRef) {
                        if (currentRef.keys && currentRef.keys.length && childState._doc._id) {
                            for (const key of currentRef.keys) {
                                if (key.model === childState._model) {
                                    assignStateRef(key.key);
                                }
                            }
                        }
                    }

                    const childRefs = refs.filter(ref => ref.keys.some(key => key.model === state._model));
                    if (state._doc && state._doc._id) {
                        for (const ref of childRefs) {
                            for (const key of ref.keys) {
                                if (key.model === state._model) {
                                    assignDocIdToChild(key.key);
                                }
                            }
                        }
                    }

                    if (childState.children && childState.children.length) {
                        populateChildren(childState.children);
                    }
                }

                children.push(childState);

                return children;
            }, []);
        }

        const populatedChildren = populateChildren(childStates);

        state.children.push(...populatedChildren);

        return state;
    };

    return method;
}

export async function seed<T>(stateTree: State<T>) {
    await Promise.all([
        stateTree._doc.save(),
        ...stateTree.children.map(child => seed(child))
    ]);

    return stateTree;
}

export function patch<T>(state: State<T>, patches: Record<string, any>): State<T> {
    const document = state._doc;
    for (const path in patches) {
        const value = patches[path];
        document.set(path, value);
    }
    return state;
}

export async function cleanup<T>(stateTree: State<T>) {
    await Promise.all([
        stateTree._doc.delete(),
        ...stateTree.children.map(child => cleanup(child))
    ]);
}
