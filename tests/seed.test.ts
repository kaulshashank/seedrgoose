import { model, seed } from "../src";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Mongoose } from "mongoose";
import { expect } from "chai";

describe("seed()", function () {
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

        afterEach("Clean database", async function () {
            await Promise.all([
                ElderModel.deleteMany({}),
                WandModel.deleteMany({}),
                MageModel.deleteMany({}),
                DragonModel.deleteMany({}),
                GoldBarModel.deleteMany({})
            ]);
        });

        it("Seed single document", async function () {
            await seed(mage());

            const result = await MageModel.find({});

            expect(result).to.exist;
            expect(result).to.have.lengthOf(1);
            expect(result[0]).to.have.property("_id");
            const doc = result[0];
            expect(doc._id).to.exist;
            expect(doc.name).to.not.exist;
        });

        it("Seed composed state twice", async function () {
            const tree = elder(wand());

            await Promise.all([
                seed(tree),
                seed(tree)
            ]);

            const elders = await ElderModel.find({});
            const wands = await WandModel.find({});

            expect(elders[0]).to.exist;
            expect(wands[0]).to.exist;

            for (const elder of elders) {
                const validWands = wands.filter(wand => wand._id.toString() === elder.wand.wandId.toString());
                expect(validWands).to.be.an("array");
                expect(validWands, "Found more than one wand for the created elder").to.have.lengthOf(1);
            }
        });

        it("Seed a document with reference to parent", async function () {

            await seed(
                mage(
                    dragon(),
                )
            );

            const mages = await MageModel.find({});
            const dragons = await DragonModel.find({});

            expect(mages[0]).to.exist;
            expect(dragons[0]).to.exist;

            const mageDoc = mages[0];
            expect(mageDoc._id).to.exist;
            expect(mageDoc.name).to.not.exist;

            for (const dragon of dragons) {
                expect(dragon._id).to.exist;
                expect(dragon.name).to.not.exist;
                expect(dragon.mageId, "Parent -> Child reference did not get set").to.exist;
                expect(dragon.mageId.toString()).to.eq(mageDoc._id.toString());
            }
        });

        it("Seed a big tree with all sorts of references", async function () {
            const tree = elder(
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
            );

            await seed(tree);

            const elders = await ElderModel.find({});
            const mages = await MageModel.find({});
            const dragons = await DragonModel.find({});
            const goldbars = await GoldBarModel.find({});
            const wands = await WandModel.find({});

            expect(elders[0]).to.exist;
            expect(mages[0]).to.exist;
            expect(dragons[0]).to.exist;
            expect(goldbars[0]).to.exist;

            const elderDoc = elders[0];
            expect(elderDoc).to.have.property("_id").to.exist;
            expect(elderDoc).to.have.property("mages").to.have.lengthOf(2);
            expect(
                elderDoc.mages.every(
                    (mage: typeof MageModel) => mages.some((m) => m._id.toString() === mage.toString())
                )
            ).to.be.true;
            expect(elderDoc).to.have.property("wand").to.exist;
            expect(wands.some(wand => elderDoc.wand.wandId.toString() == wand._id.toString())).to.be.true;

            const mageDoc = mages[0];
            expect(mageDoc._id).to.exist;
            expect(mageDoc.name).to.not.exist;

            for (const mage of mages) {
                expect(mage).to.have.property("wands").to.be.an("array");
                if (mage.wands && mage.wands.length) {
                    expect(mage.wands).to.have.lengthOf(2);
                } else {
                    expect(mage.wands).to.have.lengthOf(0);
                }
            }

            for (const dragon of dragons) {
                expect(dragon._id).to.exist;
                expect(dragon.name).to.not.exist;
                expect(dragon.mageId, "Parent -> Child reference did not get set").to.exist;
                expect(mages.some(mage => dragon.mageId.toString() === mage._id.toString())).to.be.true;
            }

            const goldbarDragon = dragons.find(d => d.goldbars && d.goldbars.length);
            expect(goldbarDragon, "Child -> Grand-child reference did not get set").to.exist;
            expect(goldbarDragon).to.have.property("goldbars").to.have.lengthOf(2);

            for (const goldbar of goldbars) {
                expect(goldbar, "No dragonId on goldbar").to.have.property("dragonId").to.exist;
                expect(goldbar, "No mageId on goldbar").to.have.property("mageId").to.exist;
                expect(mages.some(mage => goldbar.mageId.toString() === mage._id.toString())).to.be.true;
                expect(goldbarDragon.goldbars.some((gbar: typeof GoldBarModel) => gbar.toString() === goldbar._id.toString())).to.be.true;
            }
        });
    });

    after("Disconnect", async function () {
        await mms.stop();
    });

});