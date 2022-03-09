import { cleanup, model, seed, State, StateWithDoc } from "../src";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Mongoose } from "mongoose";
import { expect } from "chai";

describe("cleanup()", function () {
    let mms: MongoMemoryServer;

    const mongoose = new Mongoose();

    before("Connect", async function () {
        mms = await MongoMemoryServer.create();

        await mongoose.connect(mms.getUri());
    })

    describe("with 'Ref'", function () {

        const ElderSchema = new mongoose.Schema({
            name: String,
            mages: [mongoose.Types.ObjectId],
            wand: {
                wandId: mongoose.Types.ObjectId
            }
        });
        const ElderModel = mongoose.model("elders", ElderSchema);
        
        const MageSchema = new mongoose.Schema({
            name: String,
            element: String,
            wands: [{
                wandId: mongoose.Types.ObjectId,
                foundOn: {
                    default: Date.now,
                    type: Date
                }
            }]
        });
        const MageModel = mongoose.model("mages", MageSchema);
        
        const DragonSchema = new mongoose.Schema({
            name: String,
            age: {
                type: Number,
                default: 100
            },
            mageId: mongoose.Types.ObjectId,
            goldbars: [mongoose.Types.ObjectId],
        });
        
        const DragonModel = mongoose.model("dragons", DragonSchema);
        
        const GoldBarSchema = new mongoose.Schema({
            weightInKg: {
                type: Number,
                default: 1
            },
            dragonId: mongoose.Types.ObjectId,
            mageId: mongoose.Types.ObjectId
        });
        const GoldBarModel = mongoose.model("goldbars", GoldBarSchema);
        
        const WandSchema = new mongoose.Schema({
            wood: String,
        });
        const WandModel = mongoose.model("wands", WandSchema);

        const refs = [
            {
                model: ElderModel,
                keys: [
                    { key: ["mages"], model: MageModel },
                    { key: "wand.wandId", model: WandModel },
                ]
            },
            {
                model: MageModel,
                keys: [
                    { key: "elderId", model: ElderModel },
                    { key: ["wands.wandId"], model: WandModel },
                ]
            },
            {
                model: DragonModel,
                keys: [
                    { key: "mageId", model: MageModel },
                    { key: ["goldbars"], model: GoldBarModel },
                ]
            },
            {
                model: GoldBarModel,
                keys: [
                    { key: "mageId", model: MageModel },
                    { key: "dragonId", model: DragonModel },
                ]
            }
        ];

        const elder = model(ElderModel, refs);
        const mage = model(MageModel, refs);
        const wand = model(WandModel, refs);
        const dragon = model(DragonModel, refs);
        const goldbar = model(GoldBarModel, refs);

        let stateTree: StateWithDoc<any>;
        before("Seed", async () => {
            stateTree = await seed(
                elder(
                    wand(),
                    mage(
                        wand(),
                        wand(),
                        dragon(
                            goldbar(),
                            goldbar(),
                        ),
                        dragon()
                    ),
                    mage()
                )
            );
        })

        it("Cleanup big tree", async function () {
            
            await cleanup(stateTree);

            const elders = await ElderModel.find({});
            const mages = await MageModel.find({});
            const dragons = await DragonModel.find({});
            const goldbars = await GoldBarModel.find({});
            const wands = await WandModel.find({});

            expect(elders[0]).to.not.exist;
            expect(mages[0]).to.not.exist;
            expect(dragons[0]).to.not.exist;
            expect(goldbars[0]).to.not.exist;
            expect(wands[0]).to.not.exist;

        });
    });

    after("Disconnect", async function () {
        mms.stop();
    });

});