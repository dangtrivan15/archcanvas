/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
import * as $protobuf from "protobufjs/minimal";

// Common aliases
const $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const archcanvas = $root.archcanvas = (() => {

    /**
     * Namespace archcanvas.
     * @exports archcanvas
     * @namespace
     */
    const archcanvas = {};

    archcanvas.ArchCanvasFile = (function() {

        /**
         * Properties of an ArchCanvasFile.
         * @memberof archcanvas
         * @interface IArchCanvasFile
         * @property {archcanvas.IFileHeader|null} [header] ArchCanvasFile header
         * @property {archcanvas.IArchitecture|null} [architecture] ArchCanvasFile architecture
         * @property {archcanvas.ICanvasState|null} [canvasState] ArchCanvasFile canvasState
         * @property {archcanvas.IAIState|null} [aiState] ArchCanvasFile aiState
         * @property {archcanvas.IUndoHistory|null} [undoHistory] ArchCanvasFile undoHistory
         */

        /**
         * Constructs a new ArchCanvasFile.
         * @memberof archcanvas
         * @classdesc Represents an ArchCanvasFile.
         * @implements IArchCanvasFile
         * @constructor
         * @param {archcanvas.IArchCanvasFile=} [properties] Properties to set
         */
        function ArchCanvasFile(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ArchCanvasFile header.
         * @member {archcanvas.IFileHeader|null|undefined} header
         * @memberof archcanvas.ArchCanvasFile
         * @instance
         */
        ArchCanvasFile.prototype.header = null;

        /**
         * ArchCanvasFile architecture.
         * @member {archcanvas.IArchitecture|null|undefined} architecture
         * @memberof archcanvas.ArchCanvasFile
         * @instance
         */
        ArchCanvasFile.prototype.architecture = null;

        /**
         * ArchCanvasFile canvasState.
         * @member {archcanvas.ICanvasState|null|undefined} canvasState
         * @memberof archcanvas.ArchCanvasFile
         * @instance
         */
        ArchCanvasFile.prototype.canvasState = null;

        /**
         * ArchCanvasFile aiState.
         * @member {archcanvas.IAIState|null|undefined} aiState
         * @memberof archcanvas.ArchCanvasFile
         * @instance
         */
        ArchCanvasFile.prototype.aiState = null;

        /**
         * ArchCanvasFile undoHistory.
         * @member {archcanvas.IUndoHistory|null|undefined} undoHistory
         * @memberof archcanvas.ArchCanvasFile
         * @instance
         */
        ArchCanvasFile.prototype.undoHistory = null;

        /**
         * Creates a new ArchCanvasFile instance using the specified properties.
         * @function create
         * @memberof archcanvas.ArchCanvasFile
         * @static
         * @param {archcanvas.IArchCanvasFile=} [properties] Properties to set
         * @returns {archcanvas.ArchCanvasFile} ArchCanvasFile instance
         */
        ArchCanvasFile.create = function create(properties) {
            return new ArchCanvasFile(properties);
        };

        /**
         * Encodes the specified ArchCanvasFile message. Does not implicitly {@link archcanvas.ArchCanvasFile.verify|verify} messages.
         * @function encode
         * @memberof archcanvas.ArchCanvasFile
         * @static
         * @param {archcanvas.IArchCanvasFile} message ArchCanvasFile message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ArchCanvasFile.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.header != null && Object.hasOwnProperty.call(message, "header"))
                $root.archcanvas.FileHeader.encode(message.header, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
            if (message.architecture != null && Object.hasOwnProperty.call(message, "architecture"))
                $root.archcanvas.Architecture.encode(message.architecture, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
            if (message.canvasState != null && Object.hasOwnProperty.call(message, "canvasState"))
                $root.archcanvas.CanvasState.encode(message.canvasState, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
            if (message.aiState != null && Object.hasOwnProperty.call(message, "aiState"))
                $root.archcanvas.AIState.encode(message.aiState, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
            if (message.undoHistory != null && Object.hasOwnProperty.call(message, "undoHistory"))
                $root.archcanvas.UndoHistory.encode(message.undoHistory, writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified ArchCanvasFile message, length delimited. Does not implicitly {@link archcanvas.ArchCanvasFile.verify|verify} messages.
         * @function encodeDelimited
         * @memberof archcanvas.ArchCanvasFile
         * @static
         * @param {archcanvas.IArchCanvasFile} message ArchCanvasFile message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ArchCanvasFile.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes an ArchCanvasFile message from the specified reader or buffer.
         * @function decode
         * @memberof archcanvas.ArchCanvasFile
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {archcanvas.ArchCanvasFile} ArchCanvasFile
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ArchCanvasFile.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.archcanvas.ArchCanvasFile();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.header = $root.archcanvas.FileHeader.decode(reader, reader.uint32());
                        break;
                    }
                case 2: {
                        message.architecture = $root.archcanvas.Architecture.decode(reader, reader.uint32());
                        break;
                    }
                case 3: {
                        message.canvasState = $root.archcanvas.CanvasState.decode(reader, reader.uint32());
                        break;
                    }
                case 4: {
                        message.aiState = $root.archcanvas.AIState.decode(reader, reader.uint32());
                        break;
                    }
                case 5: {
                        message.undoHistory = $root.archcanvas.UndoHistory.decode(reader, reader.uint32());
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes an ArchCanvasFile message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof archcanvas.ArchCanvasFile
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {archcanvas.ArchCanvasFile} ArchCanvasFile
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ArchCanvasFile.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies an ArchCanvasFile message.
         * @function verify
         * @memberof archcanvas.ArchCanvasFile
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ArchCanvasFile.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.header != null && message.hasOwnProperty("header")) {
                let error = $root.archcanvas.FileHeader.verify(message.header);
                if (error)
                    return "header." + error;
            }
            if (message.architecture != null && message.hasOwnProperty("architecture")) {
                let error = $root.archcanvas.Architecture.verify(message.architecture);
                if (error)
                    return "architecture." + error;
            }
            if (message.canvasState != null && message.hasOwnProperty("canvasState")) {
                let error = $root.archcanvas.CanvasState.verify(message.canvasState);
                if (error)
                    return "canvasState." + error;
            }
            if (message.aiState != null && message.hasOwnProperty("aiState")) {
                let error = $root.archcanvas.AIState.verify(message.aiState);
                if (error)
                    return "aiState." + error;
            }
            if (message.undoHistory != null && message.hasOwnProperty("undoHistory")) {
                let error = $root.archcanvas.UndoHistory.verify(message.undoHistory);
                if (error)
                    return "undoHistory." + error;
            }
            return null;
        };

        /**
         * Creates an ArchCanvasFile message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof archcanvas.ArchCanvasFile
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {archcanvas.ArchCanvasFile} ArchCanvasFile
         */
        ArchCanvasFile.fromObject = function fromObject(object) {
            if (object instanceof $root.archcanvas.ArchCanvasFile)
                return object;
            let message = new $root.archcanvas.ArchCanvasFile();
            if (object.header != null) {
                if (typeof object.header !== "object")
                    throw TypeError(".archcanvas.ArchCanvasFile.header: object expected");
                message.header = $root.archcanvas.FileHeader.fromObject(object.header);
            }
            if (object.architecture != null) {
                if (typeof object.architecture !== "object")
                    throw TypeError(".archcanvas.ArchCanvasFile.architecture: object expected");
                message.architecture = $root.archcanvas.Architecture.fromObject(object.architecture);
            }
            if (object.canvasState != null) {
                if (typeof object.canvasState !== "object")
                    throw TypeError(".archcanvas.ArchCanvasFile.canvasState: object expected");
                message.canvasState = $root.archcanvas.CanvasState.fromObject(object.canvasState);
            }
            if (object.aiState != null) {
                if (typeof object.aiState !== "object")
                    throw TypeError(".archcanvas.ArchCanvasFile.aiState: object expected");
                message.aiState = $root.archcanvas.AIState.fromObject(object.aiState);
            }
            if (object.undoHistory != null) {
                if (typeof object.undoHistory !== "object")
                    throw TypeError(".archcanvas.ArchCanvasFile.undoHistory: object expected");
                message.undoHistory = $root.archcanvas.UndoHistory.fromObject(object.undoHistory);
            }
            return message;
        };

        /**
         * Creates a plain object from an ArchCanvasFile message. Also converts values to other types if specified.
         * @function toObject
         * @memberof archcanvas.ArchCanvasFile
         * @static
         * @param {archcanvas.ArchCanvasFile} message ArchCanvasFile
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ArchCanvasFile.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.header = null;
                object.architecture = null;
                object.canvasState = null;
                object.aiState = null;
                object.undoHistory = null;
            }
            if (message.header != null && message.hasOwnProperty("header"))
                object.header = $root.archcanvas.FileHeader.toObject(message.header, options);
            if (message.architecture != null && message.hasOwnProperty("architecture"))
                object.architecture = $root.archcanvas.Architecture.toObject(message.architecture, options);
            if (message.canvasState != null && message.hasOwnProperty("canvasState"))
                object.canvasState = $root.archcanvas.CanvasState.toObject(message.canvasState, options);
            if (message.aiState != null && message.hasOwnProperty("aiState"))
                object.aiState = $root.archcanvas.AIState.toObject(message.aiState, options);
            if (message.undoHistory != null && message.hasOwnProperty("undoHistory"))
                object.undoHistory = $root.archcanvas.UndoHistory.toObject(message.undoHistory, options);
            return object;
        };

        /**
         * Converts this ArchCanvasFile to JSON.
         * @function toJSON
         * @memberof archcanvas.ArchCanvasFile
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ArchCanvasFile.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ArchCanvasFile
         * @function getTypeUrl
         * @memberof archcanvas.ArchCanvasFile
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ArchCanvasFile.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/archcanvas.ArchCanvasFile";
        };

        return ArchCanvasFile;
    })();

    archcanvas.FileHeader = (function() {

        /**
         * Properties of a FileHeader.
         * @memberof archcanvas
         * @interface IFileHeader
         * @property {number|null} [formatVersion] FileHeader formatVersion
         * @property {string|null} [toolVersion] FileHeader toolVersion
         * @property {number|Long|null} [createdAtMs] FileHeader createdAtMs
         * @property {number|Long|null} [updatedAtMs] FileHeader updatedAtMs
         * @property {Uint8Array|null} [checksumSha256] FileHeader checksumSha256
         */

        /**
         * Constructs a new FileHeader.
         * @memberof archcanvas
         * @classdesc Represents a FileHeader.
         * @implements IFileHeader
         * @constructor
         * @param {archcanvas.IFileHeader=} [properties] Properties to set
         */
        function FileHeader(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * FileHeader formatVersion.
         * @member {number} formatVersion
         * @memberof archcanvas.FileHeader
         * @instance
         */
        FileHeader.prototype.formatVersion = 0;

        /**
         * FileHeader toolVersion.
         * @member {string} toolVersion
         * @memberof archcanvas.FileHeader
         * @instance
         */
        FileHeader.prototype.toolVersion = "";

        /**
         * FileHeader createdAtMs.
         * @member {number|Long} createdAtMs
         * @memberof archcanvas.FileHeader
         * @instance
         */
        FileHeader.prototype.createdAtMs = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * FileHeader updatedAtMs.
         * @member {number|Long} updatedAtMs
         * @memberof archcanvas.FileHeader
         * @instance
         */
        FileHeader.prototype.updatedAtMs = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * FileHeader checksumSha256.
         * @member {Uint8Array} checksumSha256
         * @memberof archcanvas.FileHeader
         * @instance
         */
        FileHeader.prototype.checksumSha256 = $util.newBuffer([]);

        /**
         * Creates a new FileHeader instance using the specified properties.
         * @function create
         * @memberof archcanvas.FileHeader
         * @static
         * @param {archcanvas.IFileHeader=} [properties] Properties to set
         * @returns {archcanvas.FileHeader} FileHeader instance
         */
        FileHeader.create = function create(properties) {
            return new FileHeader(properties);
        };

        /**
         * Encodes the specified FileHeader message. Does not implicitly {@link archcanvas.FileHeader.verify|verify} messages.
         * @function encode
         * @memberof archcanvas.FileHeader
         * @static
         * @param {archcanvas.IFileHeader} message FileHeader message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        FileHeader.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.formatVersion != null && Object.hasOwnProperty.call(message, "formatVersion"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.formatVersion);
            if (message.toolVersion != null && Object.hasOwnProperty.call(message, "toolVersion"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.toolVersion);
            if (message.createdAtMs != null && Object.hasOwnProperty.call(message, "createdAtMs"))
                writer.uint32(/* id 3, wireType 0 =*/24).uint64(message.createdAtMs);
            if (message.updatedAtMs != null && Object.hasOwnProperty.call(message, "updatedAtMs"))
                writer.uint32(/* id 4, wireType 0 =*/32).uint64(message.updatedAtMs);
            if (message.checksumSha256 != null && Object.hasOwnProperty.call(message, "checksumSha256"))
                writer.uint32(/* id 5, wireType 2 =*/42).bytes(message.checksumSha256);
            return writer;
        };

        /**
         * Encodes the specified FileHeader message, length delimited. Does not implicitly {@link archcanvas.FileHeader.verify|verify} messages.
         * @function encodeDelimited
         * @memberof archcanvas.FileHeader
         * @static
         * @param {archcanvas.IFileHeader} message FileHeader message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        FileHeader.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a FileHeader message from the specified reader or buffer.
         * @function decode
         * @memberof archcanvas.FileHeader
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {archcanvas.FileHeader} FileHeader
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        FileHeader.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.archcanvas.FileHeader();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.formatVersion = reader.uint32();
                        break;
                    }
                case 2: {
                        message.toolVersion = reader.string();
                        break;
                    }
                case 3: {
                        message.createdAtMs = reader.uint64();
                        break;
                    }
                case 4: {
                        message.updatedAtMs = reader.uint64();
                        break;
                    }
                case 5: {
                        message.checksumSha256 = reader.bytes();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a FileHeader message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof archcanvas.FileHeader
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {archcanvas.FileHeader} FileHeader
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        FileHeader.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a FileHeader message.
         * @function verify
         * @memberof archcanvas.FileHeader
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        FileHeader.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.formatVersion != null && message.hasOwnProperty("formatVersion"))
                if (!$util.isInteger(message.formatVersion))
                    return "formatVersion: integer expected";
            if (message.toolVersion != null && message.hasOwnProperty("toolVersion"))
                if (!$util.isString(message.toolVersion))
                    return "toolVersion: string expected";
            if (message.createdAtMs != null && message.hasOwnProperty("createdAtMs"))
                if (!$util.isInteger(message.createdAtMs) && !(message.createdAtMs && $util.isInteger(message.createdAtMs.low) && $util.isInteger(message.createdAtMs.high)))
                    return "createdAtMs: integer|Long expected";
            if (message.updatedAtMs != null && message.hasOwnProperty("updatedAtMs"))
                if (!$util.isInteger(message.updatedAtMs) && !(message.updatedAtMs && $util.isInteger(message.updatedAtMs.low) && $util.isInteger(message.updatedAtMs.high)))
                    return "updatedAtMs: integer|Long expected";
            if (message.checksumSha256 != null && message.hasOwnProperty("checksumSha256"))
                if (!(message.checksumSha256 && typeof message.checksumSha256.length === "number" || $util.isString(message.checksumSha256)))
                    return "checksumSha256: buffer expected";
            return null;
        };

        /**
         * Creates a FileHeader message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof archcanvas.FileHeader
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {archcanvas.FileHeader} FileHeader
         */
        FileHeader.fromObject = function fromObject(object) {
            if (object instanceof $root.archcanvas.FileHeader)
                return object;
            let message = new $root.archcanvas.FileHeader();
            if (object.formatVersion != null)
                message.formatVersion = object.formatVersion >>> 0;
            if (object.toolVersion != null)
                message.toolVersion = String(object.toolVersion);
            if (object.createdAtMs != null)
                if ($util.Long)
                    (message.createdAtMs = $util.Long.fromValue(object.createdAtMs)).unsigned = true;
                else if (typeof object.createdAtMs === "string")
                    message.createdAtMs = parseInt(object.createdAtMs, 10);
                else if (typeof object.createdAtMs === "number")
                    message.createdAtMs = object.createdAtMs;
                else if (typeof object.createdAtMs === "object")
                    message.createdAtMs = new $util.LongBits(object.createdAtMs.low >>> 0, object.createdAtMs.high >>> 0).toNumber(true);
            if (object.updatedAtMs != null)
                if ($util.Long)
                    (message.updatedAtMs = $util.Long.fromValue(object.updatedAtMs)).unsigned = true;
                else if (typeof object.updatedAtMs === "string")
                    message.updatedAtMs = parseInt(object.updatedAtMs, 10);
                else if (typeof object.updatedAtMs === "number")
                    message.updatedAtMs = object.updatedAtMs;
                else if (typeof object.updatedAtMs === "object")
                    message.updatedAtMs = new $util.LongBits(object.updatedAtMs.low >>> 0, object.updatedAtMs.high >>> 0).toNumber(true);
            if (object.checksumSha256 != null)
                if (typeof object.checksumSha256 === "string")
                    $util.base64.decode(object.checksumSha256, message.checksumSha256 = $util.newBuffer($util.base64.length(object.checksumSha256)), 0);
                else if (object.checksumSha256.length >= 0)
                    message.checksumSha256 = object.checksumSha256;
            return message;
        };

        /**
         * Creates a plain object from a FileHeader message. Also converts values to other types if specified.
         * @function toObject
         * @memberof archcanvas.FileHeader
         * @static
         * @param {archcanvas.FileHeader} message FileHeader
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        FileHeader.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.formatVersion = 0;
                object.toolVersion = "";
                if ($util.Long) {
                    let long = new $util.Long(0, 0, true);
                    object.createdAtMs = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.createdAtMs = options.longs === String ? "0" : 0;
                if ($util.Long) {
                    let long = new $util.Long(0, 0, true);
                    object.updatedAtMs = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.updatedAtMs = options.longs === String ? "0" : 0;
                if (options.bytes === String)
                    object.checksumSha256 = "";
                else {
                    object.checksumSha256 = [];
                    if (options.bytes !== Array)
                        object.checksumSha256 = $util.newBuffer(object.checksumSha256);
                }
            }
            if (message.formatVersion != null && message.hasOwnProperty("formatVersion"))
                object.formatVersion = message.formatVersion;
            if (message.toolVersion != null && message.hasOwnProperty("toolVersion"))
                object.toolVersion = message.toolVersion;
            if (message.createdAtMs != null && message.hasOwnProperty("createdAtMs"))
                if (typeof message.createdAtMs === "number")
                    object.createdAtMs = options.longs === String ? String(message.createdAtMs) : message.createdAtMs;
                else
                    object.createdAtMs = options.longs === String ? $util.Long.prototype.toString.call(message.createdAtMs) : options.longs === Number ? new $util.LongBits(message.createdAtMs.low >>> 0, message.createdAtMs.high >>> 0).toNumber(true) : message.createdAtMs;
            if (message.updatedAtMs != null && message.hasOwnProperty("updatedAtMs"))
                if (typeof message.updatedAtMs === "number")
                    object.updatedAtMs = options.longs === String ? String(message.updatedAtMs) : message.updatedAtMs;
                else
                    object.updatedAtMs = options.longs === String ? $util.Long.prototype.toString.call(message.updatedAtMs) : options.longs === Number ? new $util.LongBits(message.updatedAtMs.low >>> 0, message.updatedAtMs.high >>> 0).toNumber(true) : message.updatedAtMs;
            if (message.checksumSha256 != null && message.hasOwnProperty("checksumSha256"))
                object.checksumSha256 = options.bytes === String ? $util.base64.encode(message.checksumSha256, 0, message.checksumSha256.length) : options.bytes === Array ? Array.prototype.slice.call(message.checksumSha256) : message.checksumSha256;
            return object;
        };

        /**
         * Converts this FileHeader to JSON.
         * @function toJSON
         * @memberof archcanvas.FileHeader
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        FileHeader.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for FileHeader
         * @function getTypeUrl
         * @memberof archcanvas.FileHeader
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        FileHeader.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/archcanvas.FileHeader";
        };

        return FileHeader;
    })();

    archcanvas.Architecture = (function() {

        /**
         * Properties of an Architecture.
         * @memberof archcanvas
         * @interface IArchitecture
         * @property {string|null} [name] Architecture name
         * @property {string|null} [description] Architecture description
         * @property {Array.<string>|null} [owners] Architecture owners
         * @property {Array.<archcanvas.INode>|null} [nodes] Architecture nodes
         * @property {Array.<archcanvas.IEdge>|null} [edges] Architecture edges
         */

        /**
         * Constructs a new Architecture.
         * @memberof archcanvas
         * @classdesc Represents an Architecture.
         * @implements IArchitecture
         * @constructor
         * @param {archcanvas.IArchitecture=} [properties] Properties to set
         */
        function Architecture(properties) {
            this.owners = [];
            this.nodes = [];
            this.edges = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Architecture name.
         * @member {string} name
         * @memberof archcanvas.Architecture
         * @instance
         */
        Architecture.prototype.name = "";

        /**
         * Architecture description.
         * @member {string} description
         * @memberof archcanvas.Architecture
         * @instance
         */
        Architecture.prototype.description = "";

        /**
         * Architecture owners.
         * @member {Array.<string>} owners
         * @memberof archcanvas.Architecture
         * @instance
         */
        Architecture.prototype.owners = $util.emptyArray;

        /**
         * Architecture nodes.
         * @member {Array.<archcanvas.INode>} nodes
         * @memberof archcanvas.Architecture
         * @instance
         */
        Architecture.prototype.nodes = $util.emptyArray;

        /**
         * Architecture edges.
         * @member {Array.<archcanvas.IEdge>} edges
         * @memberof archcanvas.Architecture
         * @instance
         */
        Architecture.prototype.edges = $util.emptyArray;

        /**
         * Creates a new Architecture instance using the specified properties.
         * @function create
         * @memberof archcanvas.Architecture
         * @static
         * @param {archcanvas.IArchitecture=} [properties] Properties to set
         * @returns {archcanvas.Architecture} Architecture instance
         */
        Architecture.create = function create(properties) {
            return new Architecture(properties);
        };

        /**
         * Encodes the specified Architecture message. Does not implicitly {@link archcanvas.Architecture.verify|verify} messages.
         * @function encode
         * @memberof archcanvas.Architecture
         * @static
         * @param {archcanvas.IArchitecture} message Architecture message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Architecture.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.name != null && Object.hasOwnProperty.call(message, "name"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.name);
            if (message.description != null && Object.hasOwnProperty.call(message, "description"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.description);
            if (message.owners != null && message.owners.length)
                for (let i = 0; i < message.owners.length; ++i)
                    writer.uint32(/* id 3, wireType 2 =*/26).string(message.owners[i]);
            if (message.nodes != null && message.nodes.length)
                for (let i = 0; i < message.nodes.length; ++i)
                    $root.archcanvas.Node.encode(message.nodes[i], writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
            if (message.edges != null && message.edges.length)
                for (let i = 0; i < message.edges.length; ++i)
                    $root.archcanvas.Edge.encode(message.edges[i], writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified Architecture message, length delimited. Does not implicitly {@link archcanvas.Architecture.verify|verify} messages.
         * @function encodeDelimited
         * @memberof archcanvas.Architecture
         * @static
         * @param {archcanvas.IArchitecture} message Architecture message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Architecture.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes an Architecture message from the specified reader or buffer.
         * @function decode
         * @memberof archcanvas.Architecture
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {archcanvas.Architecture} Architecture
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Architecture.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.archcanvas.Architecture();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.name = reader.string();
                        break;
                    }
                case 2: {
                        message.description = reader.string();
                        break;
                    }
                case 3: {
                        if (!(message.owners && message.owners.length))
                            message.owners = [];
                        message.owners.push(reader.string());
                        break;
                    }
                case 4: {
                        if (!(message.nodes && message.nodes.length))
                            message.nodes = [];
                        message.nodes.push($root.archcanvas.Node.decode(reader, reader.uint32()));
                        break;
                    }
                case 5: {
                        if (!(message.edges && message.edges.length))
                            message.edges = [];
                        message.edges.push($root.archcanvas.Edge.decode(reader, reader.uint32()));
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes an Architecture message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof archcanvas.Architecture
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {archcanvas.Architecture} Architecture
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Architecture.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies an Architecture message.
         * @function verify
         * @memberof archcanvas.Architecture
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Architecture.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.name != null && message.hasOwnProperty("name"))
                if (!$util.isString(message.name))
                    return "name: string expected";
            if (message.description != null && message.hasOwnProperty("description"))
                if (!$util.isString(message.description))
                    return "description: string expected";
            if (message.owners != null && message.hasOwnProperty("owners")) {
                if (!Array.isArray(message.owners))
                    return "owners: array expected";
                for (let i = 0; i < message.owners.length; ++i)
                    if (!$util.isString(message.owners[i]))
                        return "owners: string[] expected";
            }
            if (message.nodes != null && message.hasOwnProperty("nodes")) {
                if (!Array.isArray(message.nodes))
                    return "nodes: array expected";
                for (let i = 0; i < message.nodes.length; ++i) {
                    let error = $root.archcanvas.Node.verify(message.nodes[i]);
                    if (error)
                        return "nodes." + error;
                }
            }
            if (message.edges != null && message.hasOwnProperty("edges")) {
                if (!Array.isArray(message.edges))
                    return "edges: array expected";
                for (let i = 0; i < message.edges.length; ++i) {
                    let error = $root.archcanvas.Edge.verify(message.edges[i]);
                    if (error)
                        return "edges." + error;
                }
            }
            return null;
        };

        /**
         * Creates an Architecture message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof archcanvas.Architecture
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {archcanvas.Architecture} Architecture
         */
        Architecture.fromObject = function fromObject(object) {
            if (object instanceof $root.archcanvas.Architecture)
                return object;
            let message = new $root.archcanvas.Architecture();
            if (object.name != null)
                message.name = String(object.name);
            if (object.description != null)
                message.description = String(object.description);
            if (object.owners) {
                if (!Array.isArray(object.owners))
                    throw TypeError(".archcanvas.Architecture.owners: array expected");
                message.owners = [];
                for (let i = 0; i < object.owners.length; ++i)
                    message.owners[i] = String(object.owners[i]);
            }
            if (object.nodes) {
                if (!Array.isArray(object.nodes))
                    throw TypeError(".archcanvas.Architecture.nodes: array expected");
                message.nodes = [];
                for (let i = 0; i < object.nodes.length; ++i) {
                    if (typeof object.nodes[i] !== "object")
                        throw TypeError(".archcanvas.Architecture.nodes: object expected");
                    message.nodes[i] = $root.archcanvas.Node.fromObject(object.nodes[i]);
                }
            }
            if (object.edges) {
                if (!Array.isArray(object.edges))
                    throw TypeError(".archcanvas.Architecture.edges: array expected");
                message.edges = [];
                for (let i = 0; i < object.edges.length; ++i) {
                    if (typeof object.edges[i] !== "object")
                        throw TypeError(".archcanvas.Architecture.edges: object expected");
                    message.edges[i] = $root.archcanvas.Edge.fromObject(object.edges[i]);
                }
            }
            return message;
        };

        /**
         * Creates a plain object from an Architecture message. Also converts values to other types if specified.
         * @function toObject
         * @memberof archcanvas.Architecture
         * @static
         * @param {archcanvas.Architecture} message Architecture
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Architecture.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.arrays || options.defaults) {
                object.owners = [];
                object.nodes = [];
                object.edges = [];
            }
            if (options.defaults) {
                object.name = "";
                object.description = "";
            }
            if (message.name != null && message.hasOwnProperty("name"))
                object.name = message.name;
            if (message.description != null && message.hasOwnProperty("description"))
                object.description = message.description;
            if (message.owners && message.owners.length) {
                object.owners = [];
                for (let j = 0; j < message.owners.length; ++j)
                    object.owners[j] = message.owners[j];
            }
            if (message.nodes && message.nodes.length) {
                object.nodes = [];
                for (let j = 0; j < message.nodes.length; ++j)
                    object.nodes[j] = $root.archcanvas.Node.toObject(message.nodes[j], options);
            }
            if (message.edges && message.edges.length) {
                object.edges = [];
                for (let j = 0; j < message.edges.length; ++j)
                    object.edges[j] = $root.archcanvas.Edge.toObject(message.edges[j], options);
            }
            return object;
        };

        /**
         * Converts this Architecture to JSON.
         * @function toJSON
         * @memberof archcanvas.Architecture
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Architecture.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for Architecture
         * @function getTypeUrl
         * @memberof archcanvas.Architecture
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Architecture.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/archcanvas.Architecture";
        };

        return Architecture;
    })();

    archcanvas.Node = (function() {

        /**
         * Properties of a Node.
         * @memberof archcanvas
         * @interface INode
         * @property {string|null} [id] Node id
         * @property {string|null} [type] Node type
         * @property {string|null} [displayName] Node displayName
         * @property {Object.<string,archcanvas.IValue>|null} [args] Node args
         * @property {Array.<archcanvas.ICodeRef>|null} [codeRefs] Node codeRefs
         * @property {Array.<archcanvas.INote>|null} [notes] Node notes
         * @property {Object.<string,archcanvas.IValue>|null} [properties] Node properties
         * @property {archcanvas.IPosition|null} [position] Node position
         * @property {Array.<archcanvas.INode>|null} [children] Node children
         * @property {string|null} [refSource] Node refSource
         */

        /**
         * Constructs a new Node.
         * @memberof archcanvas
         * @classdesc Represents a Node.
         * @implements INode
         * @constructor
         * @param {archcanvas.INode=} [properties] Properties to set
         */
        function Node(properties) {
            this.args = {};
            this.codeRefs = [];
            this.notes = [];
            this.properties = {};
            this.children = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Node id.
         * @member {string} id
         * @memberof archcanvas.Node
         * @instance
         */
        Node.prototype.id = "";

        /**
         * Node type.
         * @member {string} type
         * @memberof archcanvas.Node
         * @instance
         */
        Node.prototype.type = "";

        /**
         * Node displayName.
         * @member {string} displayName
         * @memberof archcanvas.Node
         * @instance
         */
        Node.prototype.displayName = "";

        /**
         * Node args.
         * @member {Object.<string,archcanvas.IValue>} args
         * @memberof archcanvas.Node
         * @instance
         */
        Node.prototype.args = $util.emptyObject;

        /**
         * Node codeRefs.
         * @member {Array.<archcanvas.ICodeRef>} codeRefs
         * @memberof archcanvas.Node
         * @instance
         */
        Node.prototype.codeRefs = $util.emptyArray;

        /**
         * Node notes.
         * @member {Array.<archcanvas.INote>} notes
         * @memberof archcanvas.Node
         * @instance
         */
        Node.prototype.notes = $util.emptyArray;

        /**
         * Node properties.
         * @member {Object.<string,archcanvas.IValue>} properties
         * @memberof archcanvas.Node
         * @instance
         */
        Node.prototype.properties = $util.emptyObject;

        /**
         * Node position.
         * @member {archcanvas.IPosition|null|undefined} position
         * @memberof archcanvas.Node
         * @instance
         */
        Node.prototype.position = null;

        /**
         * Node children.
         * @member {Array.<archcanvas.INode>} children
         * @memberof archcanvas.Node
         * @instance
         */
        Node.prototype.children = $util.emptyArray;

        /**
         * Node refSource.
         * @member {string} refSource
         * @memberof archcanvas.Node
         * @instance
         */
        Node.prototype.refSource = "";

        /**
         * Creates a new Node instance using the specified properties.
         * @function create
         * @memberof archcanvas.Node
         * @static
         * @param {archcanvas.INode=} [properties] Properties to set
         * @returns {archcanvas.Node} Node instance
         */
        Node.create = function create(properties) {
            return new Node(properties);
        };

        /**
         * Encodes the specified Node message. Does not implicitly {@link archcanvas.Node.verify|verify} messages.
         * @function encode
         * @memberof archcanvas.Node
         * @static
         * @param {archcanvas.INode} message Node message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Node.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
            if (message.type != null && Object.hasOwnProperty.call(message, "type"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.type);
            if (message.displayName != null && Object.hasOwnProperty.call(message, "displayName"))
                writer.uint32(/* id 3, wireType 2 =*/26).string(message.displayName);
            if (message.args != null && Object.hasOwnProperty.call(message, "args"))
                for (let keys = Object.keys(message.args), i = 0; i < keys.length; ++i) {
                    writer.uint32(/* id 4, wireType 2 =*/34).fork().uint32(/* id 1, wireType 2 =*/10).string(keys[i]);
                    $root.archcanvas.Value.encode(message.args[keys[i]], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim().ldelim();
                }
            if (message.codeRefs != null && message.codeRefs.length)
                for (let i = 0; i < message.codeRefs.length; ++i)
                    $root.archcanvas.CodeRef.encode(message.codeRefs[i], writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
            if (message.notes != null && message.notes.length)
                for (let i = 0; i < message.notes.length; ++i)
                    $root.archcanvas.Note.encode(message.notes[i], writer.uint32(/* id 6, wireType 2 =*/50).fork()).ldelim();
            if (message.properties != null && Object.hasOwnProperty.call(message, "properties"))
                for (let keys = Object.keys(message.properties), i = 0; i < keys.length; ++i) {
                    writer.uint32(/* id 7, wireType 2 =*/58).fork().uint32(/* id 1, wireType 2 =*/10).string(keys[i]);
                    $root.archcanvas.Value.encode(message.properties[keys[i]], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim().ldelim();
                }
            if (message.position != null && Object.hasOwnProperty.call(message, "position"))
                $root.archcanvas.Position.encode(message.position, writer.uint32(/* id 8, wireType 2 =*/66).fork()).ldelim();
            if (message.children != null && message.children.length)
                for (let i = 0; i < message.children.length; ++i)
                    $root.archcanvas.Node.encode(message.children[i], writer.uint32(/* id 9, wireType 2 =*/74).fork()).ldelim();
            if (message.refSource != null && Object.hasOwnProperty.call(message, "refSource"))
                writer.uint32(/* id 10, wireType 2 =*/82).string(message.refSource);
            return writer;
        };

        /**
         * Encodes the specified Node message, length delimited. Does not implicitly {@link archcanvas.Node.verify|verify} messages.
         * @function encodeDelimited
         * @memberof archcanvas.Node
         * @static
         * @param {archcanvas.INode} message Node message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Node.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a Node message from the specified reader or buffer.
         * @function decode
         * @memberof archcanvas.Node
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {archcanvas.Node} Node
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Node.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.archcanvas.Node(), key, value;
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.id = reader.string();
                        break;
                    }
                case 2: {
                        message.type = reader.string();
                        break;
                    }
                case 3: {
                        message.displayName = reader.string();
                        break;
                    }
                case 4: {
                        if (message.args === $util.emptyObject)
                            message.args = {};
                        let end2 = reader.uint32() + reader.pos;
                        key = "";
                        value = null;
                        while (reader.pos < end2) {
                            let tag2 = reader.uint32();
                            switch (tag2 >>> 3) {
                            case 1:
                                key = reader.string();
                                break;
                            case 2:
                                value = $root.archcanvas.Value.decode(reader, reader.uint32());
                                break;
                            default:
                                reader.skipType(tag2 & 7);
                                break;
                            }
                        }
                        message.args[key] = value;
                        break;
                    }
                case 5: {
                        if (!(message.codeRefs && message.codeRefs.length))
                            message.codeRefs = [];
                        message.codeRefs.push($root.archcanvas.CodeRef.decode(reader, reader.uint32()));
                        break;
                    }
                case 6: {
                        if (!(message.notes && message.notes.length))
                            message.notes = [];
                        message.notes.push($root.archcanvas.Note.decode(reader, reader.uint32()));
                        break;
                    }
                case 7: {
                        if (message.properties === $util.emptyObject)
                            message.properties = {};
                        let end2 = reader.uint32() + reader.pos;
                        key = "";
                        value = null;
                        while (reader.pos < end2) {
                            let tag2 = reader.uint32();
                            switch (tag2 >>> 3) {
                            case 1:
                                key = reader.string();
                                break;
                            case 2:
                                value = $root.archcanvas.Value.decode(reader, reader.uint32());
                                break;
                            default:
                                reader.skipType(tag2 & 7);
                                break;
                            }
                        }
                        message.properties[key] = value;
                        break;
                    }
                case 8: {
                        message.position = $root.archcanvas.Position.decode(reader, reader.uint32());
                        break;
                    }
                case 9: {
                        if (!(message.children && message.children.length))
                            message.children = [];
                        message.children.push($root.archcanvas.Node.decode(reader, reader.uint32()));
                        break;
                    }
                case 10: {
                        message.refSource = reader.string();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a Node message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof archcanvas.Node
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {archcanvas.Node} Node
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Node.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a Node message.
         * @function verify
         * @memberof archcanvas.Node
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Node.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.id != null && message.hasOwnProperty("id"))
                if (!$util.isString(message.id))
                    return "id: string expected";
            if (message.type != null && message.hasOwnProperty("type"))
                if (!$util.isString(message.type))
                    return "type: string expected";
            if (message.displayName != null && message.hasOwnProperty("displayName"))
                if (!$util.isString(message.displayName))
                    return "displayName: string expected";
            if (message.args != null && message.hasOwnProperty("args")) {
                if (!$util.isObject(message.args))
                    return "args: object expected";
                let key = Object.keys(message.args);
                for (let i = 0; i < key.length; ++i) {
                    let error = $root.archcanvas.Value.verify(message.args[key[i]]);
                    if (error)
                        return "args." + error;
                }
            }
            if (message.codeRefs != null && message.hasOwnProperty("codeRefs")) {
                if (!Array.isArray(message.codeRefs))
                    return "codeRefs: array expected";
                for (let i = 0; i < message.codeRefs.length; ++i) {
                    let error = $root.archcanvas.CodeRef.verify(message.codeRefs[i]);
                    if (error)
                        return "codeRefs." + error;
                }
            }
            if (message.notes != null && message.hasOwnProperty("notes")) {
                if (!Array.isArray(message.notes))
                    return "notes: array expected";
                for (let i = 0; i < message.notes.length; ++i) {
                    let error = $root.archcanvas.Note.verify(message.notes[i]);
                    if (error)
                        return "notes." + error;
                }
            }
            if (message.properties != null && message.hasOwnProperty("properties")) {
                if (!$util.isObject(message.properties))
                    return "properties: object expected";
                let key = Object.keys(message.properties);
                for (let i = 0; i < key.length; ++i) {
                    let error = $root.archcanvas.Value.verify(message.properties[key[i]]);
                    if (error)
                        return "properties." + error;
                }
            }
            if (message.position != null && message.hasOwnProperty("position")) {
                let error = $root.archcanvas.Position.verify(message.position);
                if (error)
                    return "position." + error;
            }
            if (message.children != null && message.hasOwnProperty("children")) {
                if (!Array.isArray(message.children))
                    return "children: array expected";
                for (let i = 0; i < message.children.length; ++i) {
                    let error = $root.archcanvas.Node.verify(message.children[i]);
                    if (error)
                        return "children." + error;
                }
            }
            if (message.refSource != null && message.hasOwnProperty("refSource"))
                if (!$util.isString(message.refSource))
                    return "refSource: string expected";
            return null;
        };

        /**
         * Creates a Node message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof archcanvas.Node
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {archcanvas.Node} Node
         */
        Node.fromObject = function fromObject(object) {
            if (object instanceof $root.archcanvas.Node)
                return object;
            let message = new $root.archcanvas.Node();
            if (object.id != null)
                message.id = String(object.id);
            if (object.type != null)
                message.type = String(object.type);
            if (object.displayName != null)
                message.displayName = String(object.displayName);
            if (object.args) {
                if (typeof object.args !== "object")
                    throw TypeError(".archcanvas.Node.args: object expected");
                message.args = {};
                for (let keys = Object.keys(object.args), i = 0; i < keys.length; ++i) {
                    if (typeof object.args[keys[i]] !== "object")
                        throw TypeError(".archcanvas.Node.args: object expected");
                    message.args[keys[i]] = $root.archcanvas.Value.fromObject(object.args[keys[i]]);
                }
            }
            if (object.codeRefs) {
                if (!Array.isArray(object.codeRefs))
                    throw TypeError(".archcanvas.Node.codeRefs: array expected");
                message.codeRefs = [];
                for (let i = 0; i < object.codeRefs.length; ++i) {
                    if (typeof object.codeRefs[i] !== "object")
                        throw TypeError(".archcanvas.Node.codeRefs: object expected");
                    message.codeRefs[i] = $root.archcanvas.CodeRef.fromObject(object.codeRefs[i]);
                }
            }
            if (object.notes) {
                if (!Array.isArray(object.notes))
                    throw TypeError(".archcanvas.Node.notes: array expected");
                message.notes = [];
                for (let i = 0; i < object.notes.length; ++i) {
                    if (typeof object.notes[i] !== "object")
                        throw TypeError(".archcanvas.Node.notes: object expected");
                    message.notes[i] = $root.archcanvas.Note.fromObject(object.notes[i]);
                }
            }
            if (object.properties) {
                if (typeof object.properties !== "object")
                    throw TypeError(".archcanvas.Node.properties: object expected");
                message.properties = {};
                for (let keys = Object.keys(object.properties), i = 0; i < keys.length; ++i) {
                    if (typeof object.properties[keys[i]] !== "object")
                        throw TypeError(".archcanvas.Node.properties: object expected");
                    message.properties[keys[i]] = $root.archcanvas.Value.fromObject(object.properties[keys[i]]);
                }
            }
            if (object.position != null) {
                if (typeof object.position !== "object")
                    throw TypeError(".archcanvas.Node.position: object expected");
                message.position = $root.archcanvas.Position.fromObject(object.position);
            }
            if (object.children) {
                if (!Array.isArray(object.children))
                    throw TypeError(".archcanvas.Node.children: array expected");
                message.children = [];
                for (let i = 0; i < object.children.length; ++i) {
                    if (typeof object.children[i] !== "object")
                        throw TypeError(".archcanvas.Node.children: object expected");
                    message.children[i] = $root.archcanvas.Node.fromObject(object.children[i]);
                }
            }
            if (object.refSource != null)
                message.refSource = String(object.refSource);
            return message;
        };

        /**
         * Creates a plain object from a Node message. Also converts values to other types if specified.
         * @function toObject
         * @memberof archcanvas.Node
         * @static
         * @param {archcanvas.Node} message Node
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Node.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.arrays || options.defaults) {
                object.codeRefs = [];
                object.notes = [];
                object.children = [];
            }
            if (options.objects || options.defaults) {
                object.args = {};
                object.properties = {};
            }
            if (options.defaults) {
                object.id = "";
                object.type = "";
                object.displayName = "";
                object.position = null;
                object.refSource = "";
            }
            if (message.id != null && message.hasOwnProperty("id"))
                object.id = message.id;
            if (message.type != null && message.hasOwnProperty("type"))
                object.type = message.type;
            if (message.displayName != null && message.hasOwnProperty("displayName"))
                object.displayName = message.displayName;
            let keys2;
            if (message.args && (keys2 = Object.keys(message.args)).length) {
                object.args = {};
                for (let j = 0; j < keys2.length; ++j)
                    object.args[keys2[j]] = $root.archcanvas.Value.toObject(message.args[keys2[j]], options);
            }
            if (message.codeRefs && message.codeRefs.length) {
                object.codeRefs = [];
                for (let j = 0; j < message.codeRefs.length; ++j)
                    object.codeRefs[j] = $root.archcanvas.CodeRef.toObject(message.codeRefs[j], options);
            }
            if (message.notes && message.notes.length) {
                object.notes = [];
                for (let j = 0; j < message.notes.length; ++j)
                    object.notes[j] = $root.archcanvas.Note.toObject(message.notes[j], options);
            }
            if (message.properties && (keys2 = Object.keys(message.properties)).length) {
                object.properties = {};
                for (let j = 0; j < keys2.length; ++j)
                    object.properties[keys2[j]] = $root.archcanvas.Value.toObject(message.properties[keys2[j]], options);
            }
            if (message.position != null && message.hasOwnProperty("position"))
                object.position = $root.archcanvas.Position.toObject(message.position, options);
            if (message.children && message.children.length) {
                object.children = [];
                for (let j = 0; j < message.children.length; ++j)
                    object.children[j] = $root.archcanvas.Node.toObject(message.children[j], options);
            }
            if (message.refSource != null && message.hasOwnProperty("refSource"))
                object.refSource = message.refSource;
            return object;
        };

        /**
         * Converts this Node to JSON.
         * @function toJSON
         * @memberof archcanvas.Node
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Node.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for Node
         * @function getTypeUrl
         * @memberof archcanvas.Node
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Node.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/archcanvas.Node";
        };

        return Node;
    })();

    archcanvas.Edge = (function() {

        /**
         * Properties of an Edge.
         * @memberof archcanvas
         * @interface IEdge
         * @property {string|null} [id] Edge id
         * @property {string|null} [fromNode] Edge fromNode
         * @property {string|null} [toNode] Edge toNode
         * @property {string|null} [fromPort] Edge fromPort
         * @property {string|null} [toPort] Edge toPort
         * @property {archcanvas.Edge.EdgeType|null} [type] Edge type
         * @property {string|null} [label] Edge label
         * @property {Object.<string,archcanvas.IValue>|null} [properties] Edge properties
         * @property {Array.<archcanvas.INote>|null} [notes] Edge notes
         */

        /**
         * Constructs a new Edge.
         * @memberof archcanvas
         * @classdesc Represents an Edge.
         * @implements IEdge
         * @constructor
         * @param {archcanvas.IEdge=} [properties] Properties to set
         */
        function Edge(properties) {
            this.properties = {};
            this.notes = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Edge id.
         * @member {string} id
         * @memberof archcanvas.Edge
         * @instance
         */
        Edge.prototype.id = "";

        /**
         * Edge fromNode.
         * @member {string} fromNode
         * @memberof archcanvas.Edge
         * @instance
         */
        Edge.prototype.fromNode = "";

        /**
         * Edge toNode.
         * @member {string} toNode
         * @memberof archcanvas.Edge
         * @instance
         */
        Edge.prototype.toNode = "";

        /**
         * Edge fromPort.
         * @member {string} fromPort
         * @memberof archcanvas.Edge
         * @instance
         */
        Edge.prototype.fromPort = "";

        /**
         * Edge toPort.
         * @member {string} toPort
         * @memberof archcanvas.Edge
         * @instance
         */
        Edge.prototype.toPort = "";

        /**
         * Edge type.
         * @member {archcanvas.Edge.EdgeType} type
         * @memberof archcanvas.Edge
         * @instance
         */
        Edge.prototype.type = 0;

        /**
         * Edge label.
         * @member {string} label
         * @memberof archcanvas.Edge
         * @instance
         */
        Edge.prototype.label = "";

        /**
         * Edge properties.
         * @member {Object.<string,archcanvas.IValue>} properties
         * @memberof archcanvas.Edge
         * @instance
         */
        Edge.prototype.properties = $util.emptyObject;

        /**
         * Edge notes.
         * @member {Array.<archcanvas.INote>} notes
         * @memberof archcanvas.Edge
         * @instance
         */
        Edge.prototype.notes = $util.emptyArray;

        /**
         * Creates a new Edge instance using the specified properties.
         * @function create
         * @memberof archcanvas.Edge
         * @static
         * @param {archcanvas.IEdge=} [properties] Properties to set
         * @returns {archcanvas.Edge} Edge instance
         */
        Edge.create = function create(properties) {
            return new Edge(properties);
        };

        /**
         * Encodes the specified Edge message. Does not implicitly {@link archcanvas.Edge.verify|verify} messages.
         * @function encode
         * @memberof archcanvas.Edge
         * @static
         * @param {archcanvas.IEdge} message Edge message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Edge.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
            if (message.fromNode != null && Object.hasOwnProperty.call(message, "fromNode"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.fromNode);
            if (message.toNode != null && Object.hasOwnProperty.call(message, "toNode"))
                writer.uint32(/* id 3, wireType 2 =*/26).string(message.toNode);
            if (message.fromPort != null && Object.hasOwnProperty.call(message, "fromPort"))
                writer.uint32(/* id 4, wireType 2 =*/34).string(message.fromPort);
            if (message.toPort != null && Object.hasOwnProperty.call(message, "toPort"))
                writer.uint32(/* id 5, wireType 2 =*/42).string(message.toPort);
            if (message.type != null && Object.hasOwnProperty.call(message, "type"))
                writer.uint32(/* id 6, wireType 0 =*/48).int32(message.type);
            if (message.label != null && Object.hasOwnProperty.call(message, "label"))
                writer.uint32(/* id 7, wireType 2 =*/58).string(message.label);
            if (message.properties != null && Object.hasOwnProperty.call(message, "properties"))
                for (let keys = Object.keys(message.properties), i = 0; i < keys.length; ++i) {
                    writer.uint32(/* id 8, wireType 2 =*/66).fork().uint32(/* id 1, wireType 2 =*/10).string(keys[i]);
                    $root.archcanvas.Value.encode(message.properties[keys[i]], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim().ldelim();
                }
            if (message.notes != null && message.notes.length)
                for (let i = 0; i < message.notes.length; ++i)
                    $root.archcanvas.Note.encode(message.notes[i], writer.uint32(/* id 9, wireType 2 =*/74).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified Edge message, length delimited. Does not implicitly {@link archcanvas.Edge.verify|verify} messages.
         * @function encodeDelimited
         * @memberof archcanvas.Edge
         * @static
         * @param {archcanvas.IEdge} message Edge message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Edge.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes an Edge message from the specified reader or buffer.
         * @function decode
         * @memberof archcanvas.Edge
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {archcanvas.Edge} Edge
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Edge.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.archcanvas.Edge(), key, value;
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.id = reader.string();
                        break;
                    }
                case 2: {
                        message.fromNode = reader.string();
                        break;
                    }
                case 3: {
                        message.toNode = reader.string();
                        break;
                    }
                case 4: {
                        message.fromPort = reader.string();
                        break;
                    }
                case 5: {
                        message.toPort = reader.string();
                        break;
                    }
                case 6: {
                        message.type = reader.int32();
                        break;
                    }
                case 7: {
                        message.label = reader.string();
                        break;
                    }
                case 8: {
                        if (message.properties === $util.emptyObject)
                            message.properties = {};
                        let end2 = reader.uint32() + reader.pos;
                        key = "";
                        value = null;
                        while (reader.pos < end2) {
                            let tag2 = reader.uint32();
                            switch (tag2 >>> 3) {
                            case 1:
                                key = reader.string();
                                break;
                            case 2:
                                value = $root.archcanvas.Value.decode(reader, reader.uint32());
                                break;
                            default:
                                reader.skipType(tag2 & 7);
                                break;
                            }
                        }
                        message.properties[key] = value;
                        break;
                    }
                case 9: {
                        if (!(message.notes && message.notes.length))
                            message.notes = [];
                        message.notes.push($root.archcanvas.Note.decode(reader, reader.uint32()));
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes an Edge message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof archcanvas.Edge
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {archcanvas.Edge} Edge
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Edge.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies an Edge message.
         * @function verify
         * @memberof archcanvas.Edge
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Edge.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.id != null && message.hasOwnProperty("id"))
                if (!$util.isString(message.id))
                    return "id: string expected";
            if (message.fromNode != null && message.hasOwnProperty("fromNode"))
                if (!$util.isString(message.fromNode))
                    return "fromNode: string expected";
            if (message.toNode != null && message.hasOwnProperty("toNode"))
                if (!$util.isString(message.toNode))
                    return "toNode: string expected";
            if (message.fromPort != null && message.hasOwnProperty("fromPort"))
                if (!$util.isString(message.fromPort))
                    return "fromPort: string expected";
            if (message.toPort != null && message.hasOwnProperty("toPort"))
                if (!$util.isString(message.toPort))
                    return "toPort: string expected";
            if (message.type != null && message.hasOwnProperty("type"))
                switch (message.type) {
                default:
                    return "type: enum value expected";
                case 0:
                case 1:
                case 2:
                    break;
                }
            if (message.label != null && message.hasOwnProperty("label"))
                if (!$util.isString(message.label))
                    return "label: string expected";
            if (message.properties != null && message.hasOwnProperty("properties")) {
                if (!$util.isObject(message.properties))
                    return "properties: object expected";
                let key = Object.keys(message.properties);
                for (let i = 0; i < key.length; ++i) {
                    let error = $root.archcanvas.Value.verify(message.properties[key[i]]);
                    if (error)
                        return "properties." + error;
                }
            }
            if (message.notes != null && message.hasOwnProperty("notes")) {
                if (!Array.isArray(message.notes))
                    return "notes: array expected";
                for (let i = 0; i < message.notes.length; ++i) {
                    let error = $root.archcanvas.Note.verify(message.notes[i]);
                    if (error)
                        return "notes." + error;
                }
            }
            return null;
        };

        /**
         * Creates an Edge message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof archcanvas.Edge
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {archcanvas.Edge} Edge
         */
        Edge.fromObject = function fromObject(object) {
            if (object instanceof $root.archcanvas.Edge)
                return object;
            let message = new $root.archcanvas.Edge();
            if (object.id != null)
                message.id = String(object.id);
            if (object.fromNode != null)
                message.fromNode = String(object.fromNode);
            if (object.toNode != null)
                message.toNode = String(object.toNode);
            if (object.fromPort != null)
                message.fromPort = String(object.fromPort);
            if (object.toPort != null)
                message.toPort = String(object.toPort);
            switch (object.type) {
            default:
                if (typeof object.type === "number") {
                    message.type = object.type;
                    break;
                }
                break;
            case "SYNC":
            case 0:
                message.type = 0;
                break;
            case "ASYNC":
            case 1:
                message.type = 1;
                break;
            case "DATA_FLOW":
            case 2:
                message.type = 2;
                break;
            }
            if (object.label != null)
                message.label = String(object.label);
            if (object.properties) {
                if (typeof object.properties !== "object")
                    throw TypeError(".archcanvas.Edge.properties: object expected");
                message.properties = {};
                for (let keys = Object.keys(object.properties), i = 0; i < keys.length; ++i) {
                    if (typeof object.properties[keys[i]] !== "object")
                        throw TypeError(".archcanvas.Edge.properties: object expected");
                    message.properties[keys[i]] = $root.archcanvas.Value.fromObject(object.properties[keys[i]]);
                }
            }
            if (object.notes) {
                if (!Array.isArray(object.notes))
                    throw TypeError(".archcanvas.Edge.notes: array expected");
                message.notes = [];
                for (let i = 0; i < object.notes.length; ++i) {
                    if (typeof object.notes[i] !== "object")
                        throw TypeError(".archcanvas.Edge.notes: object expected");
                    message.notes[i] = $root.archcanvas.Note.fromObject(object.notes[i]);
                }
            }
            return message;
        };

        /**
         * Creates a plain object from an Edge message. Also converts values to other types if specified.
         * @function toObject
         * @memberof archcanvas.Edge
         * @static
         * @param {archcanvas.Edge} message Edge
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Edge.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.arrays || options.defaults)
                object.notes = [];
            if (options.objects || options.defaults)
                object.properties = {};
            if (options.defaults) {
                object.id = "";
                object.fromNode = "";
                object.toNode = "";
                object.fromPort = "";
                object.toPort = "";
                object.type = options.enums === String ? "SYNC" : 0;
                object.label = "";
            }
            if (message.id != null && message.hasOwnProperty("id"))
                object.id = message.id;
            if (message.fromNode != null && message.hasOwnProperty("fromNode"))
                object.fromNode = message.fromNode;
            if (message.toNode != null && message.hasOwnProperty("toNode"))
                object.toNode = message.toNode;
            if (message.fromPort != null && message.hasOwnProperty("fromPort"))
                object.fromPort = message.fromPort;
            if (message.toPort != null && message.hasOwnProperty("toPort"))
                object.toPort = message.toPort;
            if (message.type != null && message.hasOwnProperty("type"))
                object.type = options.enums === String ? $root.archcanvas.Edge.EdgeType[message.type] === undefined ? message.type : $root.archcanvas.Edge.EdgeType[message.type] : message.type;
            if (message.label != null && message.hasOwnProperty("label"))
                object.label = message.label;
            let keys2;
            if (message.properties && (keys2 = Object.keys(message.properties)).length) {
                object.properties = {};
                for (let j = 0; j < keys2.length; ++j)
                    object.properties[keys2[j]] = $root.archcanvas.Value.toObject(message.properties[keys2[j]], options);
            }
            if (message.notes && message.notes.length) {
                object.notes = [];
                for (let j = 0; j < message.notes.length; ++j)
                    object.notes[j] = $root.archcanvas.Note.toObject(message.notes[j], options);
            }
            return object;
        };

        /**
         * Converts this Edge to JSON.
         * @function toJSON
         * @memberof archcanvas.Edge
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Edge.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for Edge
         * @function getTypeUrl
         * @memberof archcanvas.Edge
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Edge.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/archcanvas.Edge";
        };

        /**
         * EdgeType enum.
         * @name archcanvas.Edge.EdgeType
         * @enum {number}
         * @property {number} SYNC=0 SYNC value
         * @property {number} ASYNC=1 ASYNC value
         * @property {number} DATA_FLOW=2 DATA_FLOW value
         */
        Edge.EdgeType = (function() {
            const valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "SYNC"] = 0;
            values[valuesById[1] = "ASYNC"] = 1;
            values[valuesById[2] = "DATA_FLOW"] = 2;
            return values;
        })();

        return Edge;
    })();

    archcanvas.Note = (function() {

        /**
         * Properties of a Note.
         * @memberof archcanvas
         * @interface INote
         * @property {string|null} [id] Note id
         * @property {string|null} [author] Note author
         * @property {number|Long|null} [timestampMs] Note timestampMs
         * @property {string|null} [content] Note content
         * @property {Array.<string>|null} [tags] Note tags
         * @property {archcanvas.Note.NoteStatus|null} [status] Note status
         * @property {string|null} [suggestionType] Note suggestionType
         */

        /**
         * Constructs a new Note.
         * @memberof archcanvas
         * @classdesc Represents a Note.
         * @implements INote
         * @constructor
         * @param {archcanvas.INote=} [properties] Properties to set
         */
        function Note(properties) {
            this.tags = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Note id.
         * @member {string} id
         * @memberof archcanvas.Note
         * @instance
         */
        Note.prototype.id = "";

        /**
         * Note author.
         * @member {string} author
         * @memberof archcanvas.Note
         * @instance
         */
        Note.prototype.author = "";

        /**
         * Note timestampMs.
         * @member {number|Long} timestampMs
         * @memberof archcanvas.Note
         * @instance
         */
        Note.prototype.timestampMs = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * Note content.
         * @member {string} content
         * @memberof archcanvas.Note
         * @instance
         */
        Note.prototype.content = "";

        /**
         * Note tags.
         * @member {Array.<string>} tags
         * @memberof archcanvas.Note
         * @instance
         */
        Note.prototype.tags = $util.emptyArray;

        /**
         * Note status.
         * @member {archcanvas.Note.NoteStatus} status
         * @memberof archcanvas.Note
         * @instance
         */
        Note.prototype.status = 0;

        /**
         * Note suggestionType.
         * @member {string} suggestionType
         * @memberof archcanvas.Note
         * @instance
         */
        Note.prototype.suggestionType = "";

        /**
         * Creates a new Note instance using the specified properties.
         * @function create
         * @memberof archcanvas.Note
         * @static
         * @param {archcanvas.INote=} [properties] Properties to set
         * @returns {archcanvas.Note} Note instance
         */
        Note.create = function create(properties) {
            return new Note(properties);
        };

        /**
         * Encodes the specified Note message. Does not implicitly {@link archcanvas.Note.verify|verify} messages.
         * @function encode
         * @memberof archcanvas.Note
         * @static
         * @param {archcanvas.INote} message Note message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Note.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
            if (message.author != null && Object.hasOwnProperty.call(message, "author"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.author);
            if (message.timestampMs != null && Object.hasOwnProperty.call(message, "timestampMs"))
                writer.uint32(/* id 3, wireType 0 =*/24).uint64(message.timestampMs);
            if (message.content != null && Object.hasOwnProperty.call(message, "content"))
                writer.uint32(/* id 4, wireType 2 =*/34).string(message.content);
            if (message.tags != null && message.tags.length)
                for (let i = 0; i < message.tags.length; ++i)
                    writer.uint32(/* id 5, wireType 2 =*/42).string(message.tags[i]);
            if (message.status != null && Object.hasOwnProperty.call(message, "status"))
                writer.uint32(/* id 6, wireType 0 =*/48).int32(message.status);
            if (message.suggestionType != null && Object.hasOwnProperty.call(message, "suggestionType"))
                writer.uint32(/* id 7, wireType 2 =*/58).string(message.suggestionType);
            return writer;
        };

        /**
         * Encodes the specified Note message, length delimited. Does not implicitly {@link archcanvas.Note.verify|verify} messages.
         * @function encodeDelimited
         * @memberof archcanvas.Note
         * @static
         * @param {archcanvas.INote} message Note message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Note.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a Note message from the specified reader or buffer.
         * @function decode
         * @memberof archcanvas.Note
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {archcanvas.Note} Note
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Note.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.archcanvas.Note();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.id = reader.string();
                        break;
                    }
                case 2: {
                        message.author = reader.string();
                        break;
                    }
                case 3: {
                        message.timestampMs = reader.uint64();
                        break;
                    }
                case 4: {
                        message.content = reader.string();
                        break;
                    }
                case 5: {
                        if (!(message.tags && message.tags.length))
                            message.tags = [];
                        message.tags.push(reader.string());
                        break;
                    }
                case 6: {
                        message.status = reader.int32();
                        break;
                    }
                case 7: {
                        message.suggestionType = reader.string();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a Note message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof archcanvas.Note
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {archcanvas.Note} Note
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Note.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a Note message.
         * @function verify
         * @memberof archcanvas.Note
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Note.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.id != null && message.hasOwnProperty("id"))
                if (!$util.isString(message.id))
                    return "id: string expected";
            if (message.author != null && message.hasOwnProperty("author"))
                if (!$util.isString(message.author))
                    return "author: string expected";
            if (message.timestampMs != null && message.hasOwnProperty("timestampMs"))
                if (!$util.isInteger(message.timestampMs) && !(message.timestampMs && $util.isInteger(message.timestampMs.low) && $util.isInteger(message.timestampMs.high)))
                    return "timestampMs: integer|Long expected";
            if (message.content != null && message.hasOwnProperty("content"))
                if (!$util.isString(message.content))
                    return "content: string expected";
            if (message.tags != null && message.hasOwnProperty("tags")) {
                if (!Array.isArray(message.tags))
                    return "tags: array expected";
                for (let i = 0; i < message.tags.length; ++i)
                    if (!$util.isString(message.tags[i]))
                        return "tags: string[] expected";
            }
            if (message.status != null && message.hasOwnProperty("status"))
                switch (message.status) {
                default:
                    return "status: enum value expected";
                case 0:
                case 1:
                case 2:
                case 3:
                    break;
                }
            if (message.suggestionType != null && message.hasOwnProperty("suggestionType"))
                if (!$util.isString(message.suggestionType))
                    return "suggestionType: string expected";
            return null;
        };

        /**
         * Creates a Note message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof archcanvas.Note
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {archcanvas.Note} Note
         */
        Note.fromObject = function fromObject(object) {
            if (object instanceof $root.archcanvas.Note)
                return object;
            let message = new $root.archcanvas.Note();
            if (object.id != null)
                message.id = String(object.id);
            if (object.author != null)
                message.author = String(object.author);
            if (object.timestampMs != null)
                if ($util.Long)
                    (message.timestampMs = $util.Long.fromValue(object.timestampMs)).unsigned = true;
                else if (typeof object.timestampMs === "string")
                    message.timestampMs = parseInt(object.timestampMs, 10);
                else if (typeof object.timestampMs === "number")
                    message.timestampMs = object.timestampMs;
                else if (typeof object.timestampMs === "object")
                    message.timestampMs = new $util.LongBits(object.timestampMs.low >>> 0, object.timestampMs.high >>> 0).toNumber(true);
            if (object.content != null)
                message.content = String(object.content);
            if (object.tags) {
                if (!Array.isArray(object.tags))
                    throw TypeError(".archcanvas.Note.tags: array expected");
                message.tags = [];
                for (let i = 0; i < object.tags.length; ++i)
                    message.tags[i] = String(object.tags[i]);
            }
            switch (object.status) {
            default:
                if (typeof object.status === "number") {
                    message.status = object.status;
                    break;
                }
                break;
            case "NONE":
            case 0:
                message.status = 0;
                break;
            case "PENDING":
            case 1:
                message.status = 1;
                break;
            case "ACCEPTED":
            case 2:
                message.status = 2;
                break;
            case "DISMISSED":
            case 3:
                message.status = 3;
                break;
            }
            if (object.suggestionType != null)
                message.suggestionType = String(object.suggestionType);
            return message;
        };

        /**
         * Creates a plain object from a Note message. Also converts values to other types if specified.
         * @function toObject
         * @memberof archcanvas.Note
         * @static
         * @param {archcanvas.Note} message Note
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Note.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.arrays || options.defaults)
                object.tags = [];
            if (options.defaults) {
                object.id = "";
                object.author = "";
                if ($util.Long) {
                    let long = new $util.Long(0, 0, true);
                    object.timestampMs = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.timestampMs = options.longs === String ? "0" : 0;
                object.content = "";
                object.status = options.enums === String ? "NONE" : 0;
                object.suggestionType = "";
            }
            if (message.id != null && message.hasOwnProperty("id"))
                object.id = message.id;
            if (message.author != null && message.hasOwnProperty("author"))
                object.author = message.author;
            if (message.timestampMs != null && message.hasOwnProperty("timestampMs"))
                if (typeof message.timestampMs === "number")
                    object.timestampMs = options.longs === String ? String(message.timestampMs) : message.timestampMs;
                else
                    object.timestampMs = options.longs === String ? $util.Long.prototype.toString.call(message.timestampMs) : options.longs === Number ? new $util.LongBits(message.timestampMs.low >>> 0, message.timestampMs.high >>> 0).toNumber(true) : message.timestampMs;
            if (message.content != null && message.hasOwnProperty("content"))
                object.content = message.content;
            if (message.tags && message.tags.length) {
                object.tags = [];
                for (let j = 0; j < message.tags.length; ++j)
                    object.tags[j] = message.tags[j];
            }
            if (message.status != null && message.hasOwnProperty("status"))
                object.status = options.enums === String ? $root.archcanvas.Note.NoteStatus[message.status] === undefined ? message.status : $root.archcanvas.Note.NoteStatus[message.status] : message.status;
            if (message.suggestionType != null && message.hasOwnProperty("suggestionType"))
                object.suggestionType = message.suggestionType;
            return object;
        };

        /**
         * Converts this Note to JSON.
         * @function toJSON
         * @memberof archcanvas.Note
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Note.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for Note
         * @function getTypeUrl
         * @memberof archcanvas.Note
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Note.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/archcanvas.Note";
        };

        /**
         * NoteStatus enum.
         * @name archcanvas.Note.NoteStatus
         * @enum {number}
         * @property {number} NONE=0 NONE value
         * @property {number} PENDING=1 PENDING value
         * @property {number} ACCEPTED=2 ACCEPTED value
         * @property {number} DISMISSED=3 DISMISSED value
         */
        Note.NoteStatus = (function() {
            const valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "NONE"] = 0;
            values[valuesById[1] = "PENDING"] = 1;
            values[valuesById[2] = "ACCEPTED"] = 2;
            values[valuesById[3] = "DISMISSED"] = 3;
            return values;
        })();

        return Note;
    })();

    archcanvas.CodeRef = (function() {

        /**
         * Properties of a CodeRef.
         * @memberof archcanvas
         * @interface ICodeRef
         * @property {string|null} [path] CodeRef path
         * @property {archcanvas.CodeRef.CodeRefRole|null} [role] CodeRef role
         */

        /**
         * Constructs a new CodeRef.
         * @memberof archcanvas
         * @classdesc Represents a CodeRef.
         * @implements ICodeRef
         * @constructor
         * @param {archcanvas.ICodeRef=} [properties] Properties to set
         */
        function CodeRef(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * CodeRef path.
         * @member {string} path
         * @memberof archcanvas.CodeRef
         * @instance
         */
        CodeRef.prototype.path = "";

        /**
         * CodeRef role.
         * @member {archcanvas.CodeRef.CodeRefRole} role
         * @memberof archcanvas.CodeRef
         * @instance
         */
        CodeRef.prototype.role = 0;

        /**
         * Creates a new CodeRef instance using the specified properties.
         * @function create
         * @memberof archcanvas.CodeRef
         * @static
         * @param {archcanvas.ICodeRef=} [properties] Properties to set
         * @returns {archcanvas.CodeRef} CodeRef instance
         */
        CodeRef.create = function create(properties) {
            return new CodeRef(properties);
        };

        /**
         * Encodes the specified CodeRef message. Does not implicitly {@link archcanvas.CodeRef.verify|verify} messages.
         * @function encode
         * @memberof archcanvas.CodeRef
         * @static
         * @param {archcanvas.ICodeRef} message CodeRef message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        CodeRef.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.path != null && Object.hasOwnProperty.call(message, "path"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.path);
            if (message.role != null && Object.hasOwnProperty.call(message, "role"))
                writer.uint32(/* id 2, wireType 0 =*/16).int32(message.role);
            return writer;
        };

        /**
         * Encodes the specified CodeRef message, length delimited. Does not implicitly {@link archcanvas.CodeRef.verify|verify} messages.
         * @function encodeDelimited
         * @memberof archcanvas.CodeRef
         * @static
         * @param {archcanvas.ICodeRef} message CodeRef message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        CodeRef.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a CodeRef message from the specified reader or buffer.
         * @function decode
         * @memberof archcanvas.CodeRef
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {archcanvas.CodeRef} CodeRef
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        CodeRef.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.archcanvas.CodeRef();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.path = reader.string();
                        break;
                    }
                case 2: {
                        message.role = reader.int32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a CodeRef message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof archcanvas.CodeRef
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {archcanvas.CodeRef} CodeRef
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        CodeRef.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a CodeRef message.
         * @function verify
         * @memberof archcanvas.CodeRef
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        CodeRef.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.path != null && message.hasOwnProperty("path"))
                if (!$util.isString(message.path))
                    return "path: string expected";
            if (message.role != null && message.hasOwnProperty("role"))
                switch (message.role) {
                default:
                    return "role: enum value expected";
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                    break;
                }
            return null;
        };

        /**
         * Creates a CodeRef message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof archcanvas.CodeRef
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {archcanvas.CodeRef} CodeRef
         */
        CodeRef.fromObject = function fromObject(object) {
            if (object instanceof $root.archcanvas.CodeRef)
                return object;
            let message = new $root.archcanvas.CodeRef();
            if (object.path != null)
                message.path = String(object.path);
            switch (object.role) {
            default:
                if (typeof object.role === "number") {
                    message.role = object.role;
                    break;
                }
                break;
            case "SOURCE":
            case 0:
                message.role = 0;
                break;
            case "API_SPEC":
            case 1:
                message.role = 1;
                break;
            case "SCHEMA":
            case 2:
                message.role = 2;
                break;
            case "DEPLOYMENT":
            case 3:
                message.role = 3;
                break;
            case "CONFIG":
            case 4:
                message.role = 4;
                break;
            case "TEST":
            case 5:
                message.role = 5;
                break;
            }
            return message;
        };

        /**
         * Creates a plain object from a CodeRef message. Also converts values to other types if specified.
         * @function toObject
         * @memberof archcanvas.CodeRef
         * @static
         * @param {archcanvas.CodeRef} message CodeRef
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        CodeRef.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.path = "";
                object.role = options.enums === String ? "SOURCE" : 0;
            }
            if (message.path != null && message.hasOwnProperty("path"))
                object.path = message.path;
            if (message.role != null && message.hasOwnProperty("role"))
                object.role = options.enums === String ? $root.archcanvas.CodeRef.CodeRefRole[message.role] === undefined ? message.role : $root.archcanvas.CodeRef.CodeRefRole[message.role] : message.role;
            return object;
        };

        /**
         * Converts this CodeRef to JSON.
         * @function toJSON
         * @memberof archcanvas.CodeRef
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        CodeRef.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for CodeRef
         * @function getTypeUrl
         * @memberof archcanvas.CodeRef
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        CodeRef.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/archcanvas.CodeRef";
        };

        /**
         * CodeRefRole enum.
         * @name archcanvas.CodeRef.CodeRefRole
         * @enum {number}
         * @property {number} SOURCE=0 SOURCE value
         * @property {number} API_SPEC=1 API_SPEC value
         * @property {number} SCHEMA=2 SCHEMA value
         * @property {number} DEPLOYMENT=3 DEPLOYMENT value
         * @property {number} CONFIG=4 CONFIG value
         * @property {number} TEST=5 TEST value
         */
        CodeRef.CodeRefRole = (function() {
            const valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "SOURCE"] = 0;
            values[valuesById[1] = "API_SPEC"] = 1;
            values[valuesById[2] = "SCHEMA"] = 2;
            values[valuesById[3] = "DEPLOYMENT"] = 3;
            values[valuesById[4] = "CONFIG"] = 4;
            values[valuesById[5] = "TEST"] = 5;
            return values;
        })();

        return CodeRef;
    })();

    archcanvas.Position = (function() {

        /**
         * Properties of a Position.
         * @memberof archcanvas
         * @interface IPosition
         * @property {number|null} [x] Position x
         * @property {number|null} [y] Position y
         * @property {number|null} [width] Position width
         * @property {number|null} [height] Position height
         * @property {string|null} [color] Position color
         */

        /**
         * Constructs a new Position.
         * @memberof archcanvas
         * @classdesc Represents a Position.
         * @implements IPosition
         * @constructor
         * @param {archcanvas.IPosition=} [properties] Properties to set
         */
        function Position(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Position x.
         * @member {number} x
         * @memberof archcanvas.Position
         * @instance
         */
        Position.prototype.x = 0;

        /**
         * Position y.
         * @member {number} y
         * @memberof archcanvas.Position
         * @instance
         */
        Position.prototype.y = 0;

        /**
         * Position width.
         * @member {number} width
         * @memberof archcanvas.Position
         * @instance
         */
        Position.prototype.width = 0;

        /**
         * Position height.
         * @member {number} height
         * @memberof archcanvas.Position
         * @instance
         */
        Position.prototype.height = 0;

        /**
         * Position color.
         * @member {string} color
         * @memberof archcanvas.Position
         * @instance
         */
        Position.prototype.color = "";

        /**
         * Creates a new Position instance using the specified properties.
         * @function create
         * @memberof archcanvas.Position
         * @static
         * @param {archcanvas.IPosition=} [properties] Properties to set
         * @returns {archcanvas.Position} Position instance
         */
        Position.create = function create(properties) {
            return new Position(properties);
        };

        /**
         * Encodes the specified Position message. Does not implicitly {@link archcanvas.Position.verify|verify} messages.
         * @function encode
         * @memberof archcanvas.Position
         * @static
         * @param {archcanvas.IPosition} message Position message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Position.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.x != null && Object.hasOwnProperty.call(message, "x"))
                writer.uint32(/* id 1, wireType 1 =*/9).double(message.x);
            if (message.y != null && Object.hasOwnProperty.call(message, "y"))
                writer.uint32(/* id 2, wireType 1 =*/17).double(message.y);
            if (message.width != null && Object.hasOwnProperty.call(message, "width"))
                writer.uint32(/* id 3, wireType 1 =*/25).double(message.width);
            if (message.height != null && Object.hasOwnProperty.call(message, "height"))
                writer.uint32(/* id 4, wireType 1 =*/33).double(message.height);
            if (message.color != null && Object.hasOwnProperty.call(message, "color"))
                writer.uint32(/* id 5, wireType 2 =*/42).string(message.color);
            return writer;
        };

        /**
         * Encodes the specified Position message, length delimited. Does not implicitly {@link archcanvas.Position.verify|verify} messages.
         * @function encodeDelimited
         * @memberof archcanvas.Position
         * @static
         * @param {archcanvas.IPosition} message Position message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Position.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a Position message from the specified reader or buffer.
         * @function decode
         * @memberof archcanvas.Position
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {archcanvas.Position} Position
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Position.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.archcanvas.Position();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.x = reader.double();
                        break;
                    }
                case 2: {
                        message.y = reader.double();
                        break;
                    }
                case 3: {
                        message.width = reader.double();
                        break;
                    }
                case 4: {
                        message.height = reader.double();
                        break;
                    }
                case 5: {
                        message.color = reader.string();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a Position message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof archcanvas.Position
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {archcanvas.Position} Position
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Position.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a Position message.
         * @function verify
         * @memberof archcanvas.Position
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Position.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.x != null && message.hasOwnProperty("x"))
                if (typeof message.x !== "number")
                    return "x: number expected";
            if (message.y != null && message.hasOwnProperty("y"))
                if (typeof message.y !== "number")
                    return "y: number expected";
            if (message.width != null && message.hasOwnProperty("width"))
                if (typeof message.width !== "number")
                    return "width: number expected";
            if (message.height != null && message.hasOwnProperty("height"))
                if (typeof message.height !== "number")
                    return "height: number expected";
            if (message.color != null && message.hasOwnProperty("color"))
                if (!$util.isString(message.color))
                    return "color: string expected";
            return null;
        };

        /**
         * Creates a Position message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof archcanvas.Position
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {archcanvas.Position} Position
         */
        Position.fromObject = function fromObject(object) {
            if (object instanceof $root.archcanvas.Position)
                return object;
            let message = new $root.archcanvas.Position();
            if (object.x != null)
                message.x = Number(object.x);
            if (object.y != null)
                message.y = Number(object.y);
            if (object.width != null)
                message.width = Number(object.width);
            if (object.height != null)
                message.height = Number(object.height);
            if (object.color != null)
                message.color = String(object.color);
            return message;
        };

        /**
         * Creates a plain object from a Position message. Also converts values to other types if specified.
         * @function toObject
         * @memberof archcanvas.Position
         * @static
         * @param {archcanvas.Position} message Position
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Position.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.x = 0;
                object.y = 0;
                object.width = 0;
                object.height = 0;
                object.color = "";
            }
            if (message.x != null && message.hasOwnProperty("x"))
                object.x = options.json && !isFinite(message.x) ? String(message.x) : message.x;
            if (message.y != null && message.hasOwnProperty("y"))
                object.y = options.json && !isFinite(message.y) ? String(message.y) : message.y;
            if (message.width != null && message.hasOwnProperty("width"))
                object.width = options.json && !isFinite(message.width) ? String(message.width) : message.width;
            if (message.height != null && message.hasOwnProperty("height"))
                object.height = options.json && !isFinite(message.height) ? String(message.height) : message.height;
            if (message.color != null && message.hasOwnProperty("color"))
                object.color = message.color;
            return object;
        };

        /**
         * Converts this Position to JSON.
         * @function toJSON
         * @memberof archcanvas.Position
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Position.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for Position
         * @function getTypeUrl
         * @memberof archcanvas.Position
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Position.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/archcanvas.Position";
        };

        return Position;
    })();

    archcanvas.CanvasState = (function() {

        /**
         * Properties of a CanvasState.
         * @memberof archcanvas
         * @interface ICanvasState
         * @property {number|null} [viewportX] CanvasState viewportX
         * @property {number|null} [viewportY] CanvasState viewportY
         * @property {number|null} [viewportZoom] CanvasState viewportZoom
         * @property {Array.<string>|null} [selectedNodeIds] CanvasState selectedNodeIds
         * @property {Array.<string>|null} [navigationPath] CanvasState navigationPath
         * @property {archcanvas.IPanelLayout|null} [panelLayout] CanvasState panelLayout
         */

        /**
         * Constructs a new CanvasState.
         * @memberof archcanvas
         * @classdesc Represents a CanvasState.
         * @implements ICanvasState
         * @constructor
         * @param {archcanvas.ICanvasState=} [properties] Properties to set
         */
        function CanvasState(properties) {
            this.selectedNodeIds = [];
            this.navigationPath = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * CanvasState viewportX.
         * @member {number} viewportX
         * @memberof archcanvas.CanvasState
         * @instance
         */
        CanvasState.prototype.viewportX = 0;

        /**
         * CanvasState viewportY.
         * @member {number} viewportY
         * @memberof archcanvas.CanvasState
         * @instance
         */
        CanvasState.prototype.viewportY = 0;

        /**
         * CanvasState viewportZoom.
         * @member {number} viewportZoom
         * @memberof archcanvas.CanvasState
         * @instance
         */
        CanvasState.prototype.viewportZoom = 0;

        /**
         * CanvasState selectedNodeIds.
         * @member {Array.<string>} selectedNodeIds
         * @memberof archcanvas.CanvasState
         * @instance
         */
        CanvasState.prototype.selectedNodeIds = $util.emptyArray;

        /**
         * CanvasState navigationPath.
         * @member {Array.<string>} navigationPath
         * @memberof archcanvas.CanvasState
         * @instance
         */
        CanvasState.prototype.navigationPath = $util.emptyArray;

        /**
         * CanvasState panelLayout.
         * @member {archcanvas.IPanelLayout|null|undefined} panelLayout
         * @memberof archcanvas.CanvasState
         * @instance
         */
        CanvasState.prototype.panelLayout = null;

        /**
         * Creates a new CanvasState instance using the specified properties.
         * @function create
         * @memberof archcanvas.CanvasState
         * @static
         * @param {archcanvas.ICanvasState=} [properties] Properties to set
         * @returns {archcanvas.CanvasState} CanvasState instance
         */
        CanvasState.create = function create(properties) {
            return new CanvasState(properties);
        };

        /**
         * Encodes the specified CanvasState message. Does not implicitly {@link archcanvas.CanvasState.verify|verify} messages.
         * @function encode
         * @memberof archcanvas.CanvasState
         * @static
         * @param {archcanvas.ICanvasState} message CanvasState message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        CanvasState.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.viewportX != null && Object.hasOwnProperty.call(message, "viewportX"))
                writer.uint32(/* id 1, wireType 1 =*/9).double(message.viewportX);
            if (message.viewportY != null && Object.hasOwnProperty.call(message, "viewportY"))
                writer.uint32(/* id 2, wireType 1 =*/17).double(message.viewportY);
            if (message.viewportZoom != null && Object.hasOwnProperty.call(message, "viewportZoom"))
                writer.uint32(/* id 3, wireType 1 =*/25).double(message.viewportZoom);
            if (message.selectedNodeIds != null && message.selectedNodeIds.length)
                for (let i = 0; i < message.selectedNodeIds.length; ++i)
                    writer.uint32(/* id 4, wireType 2 =*/34).string(message.selectedNodeIds[i]);
            if (message.navigationPath != null && message.navigationPath.length)
                for (let i = 0; i < message.navigationPath.length; ++i)
                    writer.uint32(/* id 5, wireType 2 =*/42).string(message.navigationPath[i]);
            if (message.panelLayout != null && Object.hasOwnProperty.call(message, "panelLayout"))
                $root.archcanvas.PanelLayout.encode(message.panelLayout, writer.uint32(/* id 6, wireType 2 =*/50).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified CanvasState message, length delimited. Does not implicitly {@link archcanvas.CanvasState.verify|verify} messages.
         * @function encodeDelimited
         * @memberof archcanvas.CanvasState
         * @static
         * @param {archcanvas.ICanvasState} message CanvasState message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        CanvasState.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a CanvasState message from the specified reader or buffer.
         * @function decode
         * @memberof archcanvas.CanvasState
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {archcanvas.CanvasState} CanvasState
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        CanvasState.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.archcanvas.CanvasState();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.viewportX = reader.double();
                        break;
                    }
                case 2: {
                        message.viewportY = reader.double();
                        break;
                    }
                case 3: {
                        message.viewportZoom = reader.double();
                        break;
                    }
                case 4: {
                        if (!(message.selectedNodeIds && message.selectedNodeIds.length))
                            message.selectedNodeIds = [];
                        message.selectedNodeIds.push(reader.string());
                        break;
                    }
                case 5: {
                        if (!(message.navigationPath && message.navigationPath.length))
                            message.navigationPath = [];
                        message.navigationPath.push(reader.string());
                        break;
                    }
                case 6: {
                        message.panelLayout = $root.archcanvas.PanelLayout.decode(reader, reader.uint32());
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a CanvasState message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof archcanvas.CanvasState
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {archcanvas.CanvasState} CanvasState
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        CanvasState.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a CanvasState message.
         * @function verify
         * @memberof archcanvas.CanvasState
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        CanvasState.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.viewportX != null && message.hasOwnProperty("viewportX"))
                if (typeof message.viewportX !== "number")
                    return "viewportX: number expected";
            if (message.viewportY != null && message.hasOwnProperty("viewportY"))
                if (typeof message.viewportY !== "number")
                    return "viewportY: number expected";
            if (message.viewportZoom != null && message.hasOwnProperty("viewportZoom"))
                if (typeof message.viewportZoom !== "number")
                    return "viewportZoom: number expected";
            if (message.selectedNodeIds != null && message.hasOwnProperty("selectedNodeIds")) {
                if (!Array.isArray(message.selectedNodeIds))
                    return "selectedNodeIds: array expected";
                for (let i = 0; i < message.selectedNodeIds.length; ++i)
                    if (!$util.isString(message.selectedNodeIds[i]))
                        return "selectedNodeIds: string[] expected";
            }
            if (message.navigationPath != null && message.hasOwnProperty("navigationPath")) {
                if (!Array.isArray(message.navigationPath))
                    return "navigationPath: array expected";
                for (let i = 0; i < message.navigationPath.length; ++i)
                    if (!$util.isString(message.navigationPath[i]))
                        return "navigationPath: string[] expected";
            }
            if (message.panelLayout != null && message.hasOwnProperty("panelLayout")) {
                let error = $root.archcanvas.PanelLayout.verify(message.panelLayout);
                if (error)
                    return "panelLayout." + error;
            }
            return null;
        };

        /**
         * Creates a CanvasState message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof archcanvas.CanvasState
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {archcanvas.CanvasState} CanvasState
         */
        CanvasState.fromObject = function fromObject(object) {
            if (object instanceof $root.archcanvas.CanvasState)
                return object;
            let message = new $root.archcanvas.CanvasState();
            if (object.viewportX != null)
                message.viewportX = Number(object.viewportX);
            if (object.viewportY != null)
                message.viewportY = Number(object.viewportY);
            if (object.viewportZoom != null)
                message.viewportZoom = Number(object.viewportZoom);
            if (object.selectedNodeIds) {
                if (!Array.isArray(object.selectedNodeIds))
                    throw TypeError(".archcanvas.CanvasState.selectedNodeIds: array expected");
                message.selectedNodeIds = [];
                for (let i = 0; i < object.selectedNodeIds.length; ++i)
                    message.selectedNodeIds[i] = String(object.selectedNodeIds[i]);
            }
            if (object.navigationPath) {
                if (!Array.isArray(object.navigationPath))
                    throw TypeError(".archcanvas.CanvasState.navigationPath: array expected");
                message.navigationPath = [];
                for (let i = 0; i < object.navigationPath.length; ++i)
                    message.navigationPath[i] = String(object.navigationPath[i]);
            }
            if (object.panelLayout != null) {
                if (typeof object.panelLayout !== "object")
                    throw TypeError(".archcanvas.CanvasState.panelLayout: object expected");
                message.panelLayout = $root.archcanvas.PanelLayout.fromObject(object.panelLayout);
            }
            return message;
        };

        /**
         * Creates a plain object from a CanvasState message. Also converts values to other types if specified.
         * @function toObject
         * @memberof archcanvas.CanvasState
         * @static
         * @param {archcanvas.CanvasState} message CanvasState
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        CanvasState.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.arrays || options.defaults) {
                object.selectedNodeIds = [];
                object.navigationPath = [];
            }
            if (options.defaults) {
                object.viewportX = 0;
                object.viewportY = 0;
                object.viewportZoom = 0;
                object.panelLayout = null;
            }
            if (message.viewportX != null && message.hasOwnProperty("viewportX"))
                object.viewportX = options.json && !isFinite(message.viewportX) ? String(message.viewportX) : message.viewportX;
            if (message.viewportY != null && message.hasOwnProperty("viewportY"))
                object.viewportY = options.json && !isFinite(message.viewportY) ? String(message.viewportY) : message.viewportY;
            if (message.viewportZoom != null && message.hasOwnProperty("viewportZoom"))
                object.viewportZoom = options.json && !isFinite(message.viewportZoom) ? String(message.viewportZoom) : message.viewportZoom;
            if (message.selectedNodeIds && message.selectedNodeIds.length) {
                object.selectedNodeIds = [];
                for (let j = 0; j < message.selectedNodeIds.length; ++j)
                    object.selectedNodeIds[j] = message.selectedNodeIds[j];
            }
            if (message.navigationPath && message.navigationPath.length) {
                object.navigationPath = [];
                for (let j = 0; j < message.navigationPath.length; ++j)
                    object.navigationPath[j] = message.navigationPath[j];
            }
            if (message.panelLayout != null && message.hasOwnProperty("panelLayout"))
                object.panelLayout = $root.archcanvas.PanelLayout.toObject(message.panelLayout, options);
            return object;
        };

        /**
         * Converts this CanvasState to JSON.
         * @function toJSON
         * @memberof archcanvas.CanvasState
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        CanvasState.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for CanvasState
         * @function getTypeUrl
         * @memberof archcanvas.CanvasState
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        CanvasState.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/archcanvas.CanvasState";
        };

        return CanvasState;
    })();

    archcanvas.PanelLayout = (function() {

        /**
         * Properties of a PanelLayout.
         * @memberof archcanvas
         * @interface IPanelLayout
         * @property {boolean|null} [rightPanelOpen] PanelLayout rightPanelOpen
         * @property {string|null} [rightPanelTab] PanelLayout rightPanelTab
         * @property {number|null} [rightPanelWidth] PanelLayout rightPanelWidth
         */

        /**
         * Constructs a new PanelLayout.
         * @memberof archcanvas
         * @classdesc Represents a PanelLayout.
         * @implements IPanelLayout
         * @constructor
         * @param {archcanvas.IPanelLayout=} [properties] Properties to set
         */
        function PanelLayout(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * PanelLayout rightPanelOpen.
         * @member {boolean} rightPanelOpen
         * @memberof archcanvas.PanelLayout
         * @instance
         */
        PanelLayout.prototype.rightPanelOpen = false;

        /**
         * PanelLayout rightPanelTab.
         * @member {string} rightPanelTab
         * @memberof archcanvas.PanelLayout
         * @instance
         */
        PanelLayout.prototype.rightPanelTab = "";

        /**
         * PanelLayout rightPanelWidth.
         * @member {number} rightPanelWidth
         * @memberof archcanvas.PanelLayout
         * @instance
         */
        PanelLayout.prototype.rightPanelWidth = 0;

        /**
         * Creates a new PanelLayout instance using the specified properties.
         * @function create
         * @memberof archcanvas.PanelLayout
         * @static
         * @param {archcanvas.IPanelLayout=} [properties] Properties to set
         * @returns {archcanvas.PanelLayout} PanelLayout instance
         */
        PanelLayout.create = function create(properties) {
            return new PanelLayout(properties);
        };

        /**
         * Encodes the specified PanelLayout message. Does not implicitly {@link archcanvas.PanelLayout.verify|verify} messages.
         * @function encode
         * @memberof archcanvas.PanelLayout
         * @static
         * @param {archcanvas.IPanelLayout} message PanelLayout message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PanelLayout.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.rightPanelOpen != null && Object.hasOwnProperty.call(message, "rightPanelOpen"))
                writer.uint32(/* id 1, wireType 0 =*/8).bool(message.rightPanelOpen);
            if (message.rightPanelTab != null && Object.hasOwnProperty.call(message, "rightPanelTab"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.rightPanelTab);
            if (message.rightPanelWidth != null && Object.hasOwnProperty.call(message, "rightPanelWidth"))
                writer.uint32(/* id 3, wireType 1 =*/25).double(message.rightPanelWidth);
            return writer;
        };

        /**
         * Encodes the specified PanelLayout message, length delimited. Does not implicitly {@link archcanvas.PanelLayout.verify|verify} messages.
         * @function encodeDelimited
         * @memberof archcanvas.PanelLayout
         * @static
         * @param {archcanvas.IPanelLayout} message PanelLayout message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PanelLayout.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a PanelLayout message from the specified reader or buffer.
         * @function decode
         * @memberof archcanvas.PanelLayout
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {archcanvas.PanelLayout} PanelLayout
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PanelLayout.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.archcanvas.PanelLayout();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.rightPanelOpen = reader.bool();
                        break;
                    }
                case 2: {
                        message.rightPanelTab = reader.string();
                        break;
                    }
                case 3: {
                        message.rightPanelWidth = reader.double();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a PanelLayout message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof archcanvas.PanelLayout
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {archcanvas.PanelLayout} PanelLayout
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PanelLayout.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a PanelLayout message.
         * @function verify
         * @memberof archcanvas.PanelLayout
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        PanelLayout.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.rightPanelOpen != null && message.hasOwnProperty("rightPanelOpen"))
                if (typeof message.rightPanelOpen !== "boolean")
                    return "rightPanelOpen: boolean expected";
            if (message.rightPanelTab != null && message.hasOwnProperty("rightPanelTab"))
                if (!$util.isString(message.rightPanelTab))
                    return "rightPanelTab: string expected";
            if (message.rightPanelWidth != null && message.hasOwnProperty("rightPanelWidth"))
                if (typeof message.rightPanelWidth !== "number")
                    return "rightPanelWidth: number expected";
            return null;
        };

        /**
         * Creates a PanelLayout message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof archcanvas.PanelLayout
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {archcanvas.PanelLayout} PanelLayout
         */
        PanelLayout.fromObject = function fromObject(object) {
            if (object instanceof $root.archcanvas.PanelLayout)
                return object;
            let message = new $root.archcanvas.PanelLayout();
            if (object.rightPanelOpen != null)
                message.rightPanelOpen = Boolean(object.rightPanelOpen);
            if (object.rightPanelTab != null)
                message.rightPanelTab = String(object.rightPanelTab);
            if (object.rightPanelWidth != null)
                message.rightPanelWidth = Number(object.rightPanelWidth);
            return message;
        };

        /**
         * Creates a plain object from a PanelLayout message. Also converts values to other types if specified.
         * @function toObject
         * @memberof archcanvas.PanelLayout
         * @static
         * @param {archcanvas.PanelLayout} message PanelLayout
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        PanelLayout.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.rightPanelOpen = false;
                object.rightPanelTab = "";
                object.rightPanelWidth = 0;
            }
            if (message.rightPanelOpen != null && message.hasOwnProperty("rightPanelOpen"))
                object.rightPanelOpen = message.rightPanelOpen;
            if (message.rightPanelTab != null && message.hasOwnProperty("rightPanelTab"))
                object.rightPanelTab = message.rightPanelTab;
            if (message.rightPanelWidth != null && message.hasOwnProperty("rightPanelWidth"))
                object.rightPanelWidth = options.json && !isFinite(message.rightPanelWidth) ? String(message.rightPanelWidth) : message.rightPanelWidth;
            return object;
        };

        /**
         * Converts this PanelLayout to JSON.
         * @function toJSON
         * @memberof archcanvas.PanelLayout
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        PanelLayout.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for PanelLayout
         * @function getTypeUrl
         * @memberof archcanvas.PanelLayout
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        PanelLayout.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/archcanvas.PanelLayout";
        };

        return PanelLayout;
    })();

    archcanvas.AIState = (function() {

        /**
         * Properties of a AIState.
         * @memberof archcanvas
         * @interface IAIState
         * @property {Array.<archcanvas.IAIConversation>|null} [conversations] AIState conversations
         */

        /**
         * Constructs a new AIState.
         * @memberof archcanvas
         * @classdesc Represents a AIState.
         * @implements IAIState
         * @constructor
         * @param {archcanvas.IAIState=} [properties] Properties to set
         */
        function AIState(properties) {
            this.conversations = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * AIState conversations.
         * @member {Array.<archcanvas.IAIConversation>} conversations
         * @memberof archcanvas.AIState
         * @instance
         */
        AIState.prototype.conversations = $util.emptyArray;

        /**
         * Creates a new AIState instance using the specified properties.
         * @function create
         * @memberof archcanvas.AIState
         * @static
         * @param {archcanvas.IAIState=} [properties] Properties to set
         * @returns {archcanvas.AIState} AIState instance
         */
        AIState.create = function create(properties) {
            return new AIState(properties);
        };

        /**
         * Encodes the specified AIState message. Does not implicitly {@link archcanvas.AIState.verify|verify} messages.
         * @function encode
         * @memberof archcanvas.AIState
         * @static
         * @param {archcanvas.IAIState} message AIState message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        AIState.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.conversations != null && message.conversations.length)
                for (let i = 0; i < message.conversations.length; ++i)
                    $root.archcanvas.AIConversation.encode(message.conversations[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified AIState message, length delimited. Does not implicitly {@link archcanvas.AIState.verify|verify} messages.
         * @function encodeDelimited
         * @memberof archcanvas.AIState
         * @static
         * @param {archcanvas.IAIState} message AIState message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        AIState.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a AIState message from the specified reader or buffer.
         * @function decode
         * @memberof archcanvas.AIState
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {archcanvas.AIState} AIState
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        AIState.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.archcanvas.AIState();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        if (!(message.conversations && message.conversations.length))
                            message.conversations = [];
                        message.conversations.push($root.archcanvas.AIConversation.decode(reader, reader.uint32()));
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a AIState message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof archcanvas.AIState
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {archcanvas.AIState} AIState
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        AIState.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a AIState message.
         * @function verify
         * @memberof archcanvas.AIState
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        AIState.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.conversations != null && message.hasOwnProperty("conversations")) {
                if (!Array.isArray(message.conversations))
                    return "conversations: array expected";
                for (let i = 0; i < message.conversations.length; ++i) {
                    let error = $root.archcanvas.AIConversation.verify(message.conversations[i]);
                    if (error)
                        return "conversations." + error;
                }
            }
            return null;
        };

        /**
         * Creates a AIState message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof archcanvas.AIState
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {archcanvas.AIState} AIState
         */
        AIState.fromObject = function fromObject(object) {
            if (object instanceof $root.archcanvas.AIState)
                return object;
            let message = new $root.archcanvas.AIState();
            if (object.conversations) {
                if (!Array.isArray(object.conversations))
                    throw TypeError(".archcanvas.AIState.conversations: array expected");
                message.conversations = [];
                for (let i = 0; i < object.conversations.length; ++i) {
                    if (typeof object.conversations[i] !== "object")
                        throw TypeError(".archcanvas.AIState.conversations: object expected");
                    message.conversations[i] = $root.archcanvas.AIConversation.fromObject(object.conversations[i]);
                }
            }
            return message;
        };

        /**
         * Creates a plain object from a AIState message. Also converts values to other types if specified.
         * @function toObject
         * @memberof archcanvas.AIState
         * @static
         * @param {archcanvas.AIState} message AIState
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        AIState.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.arrays || options.defaults)
                object.conversations = [];
            if (message.conversations && message.conversations.length) {
                object.conversations = [];
                for (let j = 0; j < message.conversations.length; ++j)
                    object.conversations[j] = $root.archcanvas.AIConversation.toObject(message.conversations[j], options);
            }
            return object;
        };

        /**
         * Converts this AIState to JSON.
         * @function toJSON
         * @memberof archcanvas.AIState
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        AIState.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for AIState
         * @function getTypeUrl
         * @memberof archcanvas.AIState
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        AIState.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/archcanvas.AIState";
        };

        return AIState;
    })();

    archcanvas.AIConversation = (function() {

        /**
         * Properties of a AIConversation.
         * @memberof archcanvas
         * @interface IAIConversation
         * @property {string|null} [id] AIConversation id
         * @property {string|null} [scopedToNodeId] AIConversation scopedToNodeId
         * @property {Array.<archcanvas.IAIMessage>|null} [messages] AIConversation messages
         * @property {number|Long|null} [createdAtMs] AIConversation createdAtMs
         */

        /**
         * Constructs a new AIConversation.
         * @memberof archcanvas
         * @classdesc Represents a AIConversation.
         * @implements IAIConversation
         * @constructor
         * @param {archcanvas.IAIConversation=} [properties] Properties to set
         */
        function AIConversation(properties) {
            this.messages = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * AIConversation id.
         * @member {string} id
         * @memberof archcanvas.AIConversation
         * @instance
         */
        AIConversation.prototype.id = "";

        /**
         * AIConversation scopedToNodeId.
         * @member {string} scopedToNodeId
         * @memberof archcanvas.AIConversation
         * @instance
         */
        AIConversation.prototype.scopedToNodeId = "";

        /**
         * AIConversation messages.
         * @member {Array.<archcanvas.IAIMessage>} messages
         * @memberof archcanvas.AIConversation
         * @instance
         */
        AIConversation.prototype.messages = $util.emptyArray;

        /**
         * AIConversation createdAtMs.
         * @member {number|Long} createdAtMs
         * @memberof archcanvas.AIConversation
         * @instance
         */
        AIConversation.prototype.createdAtMs = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * Creates a new AIConversation instance using the specified properties.
         * @function create
         * @memberof archcanvas.AIConversation
         * @static
         * @param {archcanvas.IAIConversation=} [properties] Properties to set
         * @returns {archcanvas.AIConversation} AIConversation instance
         */
        AIConversation.create = function create(properties) {
            return new AIConversation(properties);
        };

        /**
         * Encodes the specified AIConversation message. Does not implicitly {@link archcanvas.AIConversation.verify|verify} messages.
         * @function encode
         * @memberof archcanvas.AIConversation
         * @static
         * @param {archcanvas.IAIConversation} message AIConversation message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        AIConversation.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
            if (message.scopedToNodeId != null && Object.hasOwnProperty.call(message, "scopedToNodeId"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.scopedToNodeId);
            if (message.messages != null && message.messages.length)
                for (let i = 0; i < message.messages.length; ++i)
                    $root.archcanvas.AIMessage.encode(message.messages[i], writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
            if (message.createdAtMs != null && Object.hasOwnProperty.call(message, "createdAtMs"))
                writer.uint32(/* id 4, wireType 0 =*/32).uint64(message.createdAtMs);
            return writer;
        };

        /**
         * Encodes the specified AIConversation message, length delimited. Does not implicitly {@link archcanvas.AIConversation.verify|verify} messages.
         * @function encodeDelimited
         * @memberof archcanvas.AIConversation
         * @static
         * @param {archcanvas.IAIConversation} message AIConversation message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        AIConversation.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a AIConversation message from the specified reader or buffer.
         * @function decode
         * @memberof archcanvas.AIConversation
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {archcanvas.AIConversation} AIConversation
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        AIConversation.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.archcanvas.AIConversation();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.id = reader.string();
                        break;
                    }
                case 2: {
                        message.scopedToNodeId = reader.string();
                        break;
                    }
                case 3: {
                        if (!(message.messages && message.messages.length))
                            message.messages = [];
                        message.messages.push($root.archcanvas.AIMessage.decode(reader, reader.uint32()));
                        break;
                    }
                case 4: {
                        message.createdAtMs = reader.uint64();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a AIConversation message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof archcanvas.AIConversation
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {archcanvas.AIConversation} AIConversation
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        AIConversation.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a AIConversation message.
         * @function verify
         * @memberof archcanvas.AIConversation
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        AIConversation.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.id != null && message.hasOwnProperty("id"))
                if (!$util.isString(message.id))
                    return "id: string expected";
            if (message.scopedToNodeId != null && message.hasOwnProperty("scopedToNodeId"))
                if (!$util.isString(message.scopedToNodeId))
                    return "scopedToNodeId: string expected";
            if (message.messages != null && message.hasOwnProperty("messages")) {
                if (!Array.isArray(message.messages))
                    return "messages: array expected";
                for (let i = 0; i < message.messages.length; ++i) {
                    let error = $root.archcanvas.AIMessage.verify(message.messages[i]);
                    if (error)
                        return "messages." + error;
                }
            }
            if (message.createdAtMs != null && message.hasOwnProperty("createdAtMs"))
                if (!$util.isInteger(message.createdAtMs) && !(message.createdAtMs && $util.isInteger(message.createdAtMs.low) && $util.isInteger(message.createdAtMs.high)))
                    return "createdAtMs: integer|Long expected";
            return null;
        };

        /**
         * Creates a AIConversation message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof archcanvas.AIConversation
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {archcanvas.AIConversation} AIConversation
         */
        AIConversation.fromObject = function fromObject(object) {
            if (object instanceof $root.archcanvas.AIConversation)
                return object;
            let message = new $root.archcanvas.AIConversation();
            if (object.id != null)
                message.id = String(object.id);
            if (object.scopedToNodeId != null)
                message.scopedToNodeId = String(object.scopedToNodeId);
            if (object.messages) {
                if (!Array.isArray(object.messages))
                    throw TypeError(".archcanvas.AIConversation.messages: array expected");
                message.messages = [];
                for (let i = 0; i < object.messages.length; ++i) {
                    if (typeof object.messages[i] !== "object")
                        throw TypeError(".archcanvas.AIConversation.messages: object expected");
                    message.messages[i] = $root.archcanvas.AIMessage.fromObject(object.messages[i]);
                }
            }
            if (object.createdAtMs != null)
                if ($util.Long)
                    (message.createdAtMs = $util.Long.fromValue(object.createdAtMs)).unsigned = true;
                else if (typeof object.createdAtMs === "string")
                    message.createdAtMs = parseInt(object.createdAtMs, 10);
                else if (typeof object.createdAtMs === "number")
                    message.createdAtMs = object.createdAtMs;
                else if (typeof object.createdAtMs === "object")
                    message.createdAtMs = new $util.LongBits(object.createdAtMs.low >>> 0, object.createdAtMs.high >>> 0).toNumber(true);
            return message;
        };

        /**
         * Creates a plain object from a AIConversation message. Also converts values to other types if specified.
         * @function toObject
         * @memberof archcanvas.AIConversation
         * @static
         * @param {archcanvas.AIConversation} message AIConversation
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        AIConversation.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.arrays || options.defaults)
                object.messages = [];
            if (options.defaults) {
                object.id = "";
                object.scopedToNodeId = "";
                if ($util.Long) {
                    let long = new $util.Long(0, 0, true);
                    object.createdAtMs = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.createdAtMs = options.longs === String ? "0" : 0;
            }
            if (message.id != null && message.hasOwnProperty("id"))
                object.id = message.id;
            if (message.scopedToNodeId != null && message.hasOwnProperty("scopedToNodeId"))
                object.scopedToNodeId = message.scopedToNodeId;
            if (message.messages && message.messages.length) {
                object.messages = [];
                for (let j = 0; j < message.messages.length; ++j)
                    object.messages[j] = $root.archcanvas.AIMessage.toObject(message.messages[j], options);
            }
            if (message.createdAtMs != null && message.hasOwnProperty("createdAtMs"))
                if (typeof message.createdAtMs === "number")
                    object.createdAtMs = options.longs === String ? String(message.createdAtMs) : message.createdAtMs;
                else
                    object.createdAtMs = options.longs === String ? $util.Long.prototype.toString.call(message.createdAtMs) : options.longs === Number ? new $util.LongBits(message.createdAtMs.low >>> 0, message.createdAtMs.high >>> 0).toNumber(true) : message.createdAtMs;
            return object;
        };

        /**
         * Converts this AIConversation to JSON.
         * @function toJSON
         * @memberof archcanvas.AIConversation
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        AIConversation.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for AIConversation
         * @function getTypeUrl
         * @memberof archcanvas.AIConversation
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        AIConversation.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/archcanvas.AIConversation";
        };

        return AIConversation;
    })();

    archcanvas.AIMessage = (function() {

        /**
         * Properties of a AIMessage.
         * @memberof archcanvas
         * @interface IAIMessage
         * @property {string|null} [id] AIMessage id
         * @property {string|null} [role] AIMessage role
         * @property {string|null} [content] AIMessage content
         * @property {number|Long|null} [timestampMs] AIMessage timestampMs
         * @property {Array.<archcanvas.IAISuggestion>|null} [suggestions] AIMessage suggestions
         */

        /**
         * Constructs a new AIMessage.
         * @memberof archcanvas
         * @classdesc Represents a AIMessage.
         * @implements IAIMessage
         * @constructor
         * @param {archcanvas.IAIMessage=} [properties] Properties to set
         */
        function AIMessage(properties) {
            this.suggestions = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * AIMessage id.
         * @member {string} id
         * @memberof archcanvas.AIMessage
         * @instance
         */
        AIMessage.prototype.id = "";

        /**
         * AIMessage role.
         * @member {string} role
         * @memberof archcanvas.AIMessage
         * @instance
         */
        AIMessage.prototype.role = "";

        /**
         * AIMessage content.
         * @member {string} content
         * @memberof archcanvas.AIMessage
         * @instance
         */
        AIMessage.prototype.content = "";

        /**
         * AIMessage timestampMs.
         * @member {number|Long} timestampMs
         * @memberof archcanvas.AIMessage
         * @instance
         */
        AIMessage.prototype.timestampMs = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * AIMessage suggestions.
         * @member {Array.<archcanvas.IAISuggestion>} suggestions
         * @memberof archcanvas.AIMessage
         * @instance
         */
        AIMessage.prototype.suggestions = $util.emptyArray;

        /**
         * Creates a new AIMessage instance using the specified properties.
         * @function create
         * @memberof archcanvas.AIMessage
         * @static
         * @param {archcanvas.IAIMessage=} [properties] Properties to set
         * @returns {archcanvas.AIMessage} AIMessage instance
         */
        AIMessage.create = function create(properties) {
            return new AIMessage(properties);
        };

        /**
         * Encodes the specified AIMessage message. Does not implicitly {@link archcanvas.AIMessage.verify|verify} messages.
         * @function encode
         * @memberof archcanvas.AIMessage
         * @static
         * @param {archcanvas.IAIMessage} message AIMessage message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        AIMessage.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
            if (message.role != null && Object.hasOwnProperty.call(message, "role"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.role);
            if (message.content != null && Object.hasOwnProperty.call(message, "content"))
                writer.uint32(/* id 3, wireType 2 =*/26).string(message.content);
            if (message.timestampMs != null && Object.hasOwnProperty.call(message, "timestampMs"))
                writer.uint32(/* id 4, wireType 0 =*/32).uint64(message.timestampMs);
            if (message.suggestions != null && message.suggestions.length)
                for (let i = 0; i < message.suggestions.length; ++i)
                    $root.archcanvas.AISuggestion.encode(message.suggestions[i], writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified AIMessage message, length delimited. Does not implicitly {@link archcanvas.AIMessage.verify|verify} messages.
         * @function encodeDelimited
         * @memberof archcanvas.AIMessage
         * @static
         * @param {archcanvas.IAIMessage} message AIMessage message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        AIMessage.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a AIMessage message from the specified reader or buffer.
         * @function decode
         * @memberof archcanvas.AIMessage
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {archcanvas.AIMessage} AIMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        AIMessage.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.archcanvas.AIMessage();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.id = reader.string();
                        break;
                    }
                case 2: {
                        message.role = reader.string();
                        break;
                    }
                case 3: {
                        message.content = reader.string();
                        break;
                    }
                case 4: {
                        message.timestampMs = reader.uint64();
                        break;
                    }
                case 5: {
                        if (!(message.suggestions && message.suggestions.length))
                            message.suggestions = [];
                        message.suggestions.push($root.archcanvas.AISuggestion.decode(reader, reader.uint32()));
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a AIMessage message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof archcanvas.AIMessage
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {archcanvas.AIMessage} AIMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        AIMessage.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a AIMessage message.
         * @function verify
         * @memberof archcanvas.AIMessage
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        AIMessage.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.id != null && message.hasOwnProperty("id"))
                if (!$util.isString(message.id))
                    return "id: string expected";
            if (message.role != null && message.hasOwnProperty("role"))
                if (!$util.isString(message.role))
                    return "role: string expected";
            if (message.content != null && message.hasOwnProperty("content"))
                if (!$util.isString(message.content))
                    return "content: string expected";
            if (message.timestampMs != null && message.hasOwnProperty("timestampMs"))
                if (!$util.isInteger(message.timestampMs) && !(message.timestampMs && $util.isInteger(message.timestampMs.low) && $util.isInteger(message.timestampMs.high)))
                    return "timestampMs: integer|Long expected";
            if (message.suggestions != null && message.hasOwnProperty("suggestions")) {
                if (!Array.isArray(message.suggestions))
                    return "suggestions: array expected";
                for (let i = 0; i < message.suggestions.length; ++i) {
                    let error = $root.archcanvas.AISuggestion.verify(message.suggestions[i]);
                    if (error)
                        return "suggestions." + error;
                }
            }
            return null;
        };

        /**
         * Creates a AIMessage message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof archcanvas.AIMessage
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {archcanvas.AIMessage} AIMessage
         */
        AIMessage.fromObject = function fromObject(object) {
            if (object instanceof $root.archcanvas.AIMessage)
                return object;
            let message = new $root.archcanvas.AIMessage();
            if (object.id != null)
                message.id = String(object.id);
            if (object.role != null)
                message.role = String(object.role);
            if (object.content != null)
                message.content = String(object.content);
            if (object.timestampMs != null)
                if ($util.Long)
                    (message.timestampMs = $util.Long.fromValue(object.timestampMs)).unsigned = true;
                else if (typeof object.timestampMs === "string")
                    message.timestampMs = parseInt(object.timestampMs, 10);
                else if (typeof object.timestampMs === "number")
                    message.timestampMs = object.timestampMs;
                else if (typeof object.timestampMs === "object")
                    message.timestampMs = new $util.LongBits(object.timestampMs.low >>> 0, object.timestampMs.high >>> 0).toNumber(true);
            if (object.suggestions) {
                if (!Array.isArray(object.suggestions))
                    throw TypeError(".archcanvas.AIMessage.suggestions: array expected");
                message.suggestions = [];
                for (let i = 0; i < object.suggestions.length; ++i) {
                    if (typeof object.suggestions[i] !== "object")
                        throw TypeError(".archcanvas.AIMessage.suggestions: object expected");
                    message.suggestions[i] = $root.archcanvas.AISuggestion.fromObject(object.suggestions[i]);
                }
            }
            return message;
        };

        /**
         * Creates a plain object from a AIMessage message. Also converts values to other types if specified.
         * @function toObject
         * @memberof archcanvas.AIMessage
         * @static
         * @param {archcanvas.AIMessage} message AIMessage
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        AIMessage.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.arrays || options.defaults)
                object.suggestions = [];
            if (options.defaults) {
                object.id = "";
                object.role = "";
                object.content = "";
                if ($util.Long) {
                    let long = new $util.Long(0, 0, true);
                    object.timestampMs = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.timestampMs = options.longs === String ? "0" : 0;
            }
            if (message.id != null && message.hasOwnProperty("id"))
                object.id = message.id;
            if (message.role != null && message.hasOwnProperty("role"))
                object.role = message.role;
            if (message.content != null && message.hasOwnProperty("content"))
                object.content = message.content;
            if (message.timestampMs != null && message.hasOwnProperty("timestampMs"))
                if (typeof message.timestampMs === "number")
                    object.timestampMs = options.longs === String ? String(message.timestampMs) : message.timestampMs;
                else
                    object.timestampMs = options.longs === String ? $util.Long.prototype.toString.call(message.timestampMs) : options.longs === Number ? new $util.LongBits(message.timestampMs.low >>> 0, message.timestampMs.high >>> 0).toNumber(true) : message.timestampMs;
            if (message.suggestions && message.suggestions.length) {
                object.suggestions = [];
                for (let j = 0; j < message.suggestions.length; ++j)
                    object.suggestions[j] = $root.archcanvas.AISuggestion.toObject(message.suggestions[j], options);
            }
            return object;
        };

        /**
         * Converts this AIMessage to JSON.
         * @function toJSON
         * @memberof archcanvas.AIMessage
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        AIMessage.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for AIMessage
         * @function getTypeUrl
         * @memberof archcanvas.AIMessage
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        AIMessage.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/archcanvas.AIMessage";
        };

        return AIMessage;
    })();

    archcanvas.AISuggestion = (function() {

        /**
         * Properties of a AISuggestion.
         * @memberof archcanvas
         * @interface IAISuggestion
         * @property {string|null} [id] AISuggestion id
         * @property {string|null} [targetNodeId] AISuggestion targetNodeId
         * @property {string|null} [targetEdgeId] AISuggestion targetEdgeId
         * @property {string|null} [suggestionType] AISuggestion suggestionType
         * @property {string|null} [content] AISuggestion content
         * @property {archcanvas.Note.NoteStatus|null} [status] AISuggestion status
         */

        /**
         * Constructs a new AISuggestion.
         * @memberof archcanvas
         * @classdesc Represents a AISuggestion.
         * @implements IAISuggestion
         * @constructor
         * @param {archcanvas.IAISuggestion=} [properties] Properties to set
         */
        function AISuggestion(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * AISuggestion id.
         * @member {string} id
         * @memberof archcanvas.AISuggestion
         * @instance
         */
        AISuggestion.prototype.id = "";

        /**
         * AISuggestion targetNodeId.
         * @member {string} targetNodeId
         * @memberof archcanvas.AISuggestion
         * @instance
         */
        AISuggestion.prototype.targetNodeId = "";

        /**
         * AISuggestion targetEdgeId.
         * @member {string} targetEdgeId
         * @memberof archcanvas.AISuggestion
         * @instance
         */
        AISuggestion.prototype.targetEdgeId = "";

        /**
         * AISuggestion suggestionType.
         * @member {string} suggestionType
         * @memberof archcanvas.AISuggestion
         * @instance
         */
        AISuggestion.prototype.suggestionType = "";

        /**
         * AISuggestion content.
         * @member {string} content
         * @memberof archcanvas.AISuggestion
         * @instance
         */
        AISuggestion.prototype.content = "";

        /**
         * AISuggestion status.
         * @member {archcanvas.Note.NoteStatus} status
         * @memberof archcanvas.AISuggestion
         * @instance
         */
        AISuggestion.prototype.status = 0;

        /**
         * Creates a new AISuggestion instance using the specified properties.
         * @function create
         * @memberof archcanvas.AISuggestion
         * @static
         * @param {archcanvas.IAISuggestion=} [properties] Properties to set
         * @returns {archcanvas.AISuggestion} AISuggestion instance
         */
        AISuggestion.create = function create(properties) {
            return new AISuggestion(properties);
        };

        /**
         * Encodes the specified AISuggestion message. Does not implicitly {@link archcanvas.AISuggestion.verify|verify} messages.
         * @function encode
         * @memberof archcanvas.AISuggestion
         * @static
         * @param {archcanvas.IAISuggestion} message AISuggestion message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        AISuggestion.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
            if (message.targetNodeId != null && Object.hasOwnProperty.call(message, "targetNodeId"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.targetNodeId);
            if (message.targetEdgeId != null && Object.hasOwnProperty.call(message, "targetEdgeId"))
                writer.uint32(/* id 3, wireType 2 =*/26).string(message.targetEdgeId);
            if (message.suggestionType != null && Object.hasOwnProperty.call(message, "suggestionType"))
                writer.uint32(/* id 4, wireType 2 =*/34).string(message.suggestionType);
            if (message.content != null && Object.hasOwnProperty.call(message, "content"))
                writer.uint32(/* id 5, wireType 2 =*/42).string(message.content);
            if (message.status != null && Object.hasOwnProperty.call(message, "status"))
                writer.uint32(/* id 6, wireType 0 =*/48).int32(message.status);
            return writer;
        };

        /**
         * Encodes the specified AISuggestion message, length delimited. Does not implicitly {@link archcanvas.AISuggestion.verify|verify} messages.
         * @function encodeDelimited
         * @memberof archcanvas.AISuggestion
         * @static
         * @param {archcanvas.IAISuggestion} message AISuggestion message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        AISuggestion.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a AISuggestion message from the specified reader or buffer.
         * @function decode
         * @memberof archcanvas.AISuggestion
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {archcanvas.AISuggestion} AISuggestion
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        AISuggestion.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.archcanvas.AISuggestion();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.id = reader.string();
                        break;
                    }
                case 2: {
                        message.targetNodeId = reader.string();
                        break;
                    }
                case 3: {
                        message.targetEdgeId = reader.string();
                        break;
                    }
                case 4: {
                        message.suggestionType = reader.string();
                        break;
                    }
                case 5: {
                        message.content = reader.string();
                        break;
                    }
                case 6: {
                        message.status = reader.int32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a AISuggestion message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof archcanvas.AISuggestion
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {archcanvas.AISuggestion} AISuggestion
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        AISuggestion.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a AISuggestion message.
         * @function verify
         * @memberof archcanvas.AISuggestion
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        AISuggestion.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.id != null && message.hasOwnProperty("id"))
                if (!$util.isString(message.id))
                    return "id: string expected";
            if (message.targetNodeId != null && message.hasOwnProperty("targetNodeId"))
                if (!$util.isString(message.targetNodeId))
                    return "targetNodeId: string expected";
            if (message.targetEdgeId != null && message.hasOwnProperty("targetEdgeId"))
                if (!$util.isString(message.targetEdgeId))
                    return "targetEdgeId: string expected";
            if (message.suggestionType != null && message.hasOwnProperty("suggestionType"))
                if (!$util.isString(message.suggestionType))
                    return "suggestionType: string expected";
            if (message.content != null && message.hasOwnProperty("content"))
                if (!$util.isString(message.content))
                    return "content: string expected";
            if (message.status != null && message.hasOwnProperty("status"))
                switch (message.status) {
                default:
                    return "status: enum value expected";
                case 0:
                case 1:
                case 2:
                case 3:
                    break;
                }
            return null;
        };

        /**
         * Creates a AISuggestion message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof archcanvas.AISuggestion
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {archcanvas.AISuggestion} AISuggestion
         */
        AISuggestion.fromObject = function fromObject(object) {
            if (object instanceof $root.archcanvas.AISuggestion)
                return object;
            let message = new $root.archcanvas.AISuggestion();
            if (object.id != null)
                message.id = String(object.id);
            if (object.targetNodeId != null)
                message.targetNodeId = String(object.targetNodeId);
            if (object.targetEdgeId != null)
                message.targetEdgeId = String(object.targetEdgeId);
            if (object.suggestionType != null)
                message.suggestionType = String(object.suggestionType);
            if (object.content != null)
                message.content = String(object.content);
            switch (object.status) {
            default:
                if (typeof object.status === "number") {
                    message.status = object.status;
                    break;
                }
                break;
            case "NONE":
            case 0:
                message.status = 0;
                break;
            case "PENDING":
            case 1:
                message.status = 1;
                break;
            case "ACCEPTED":
            case 2:
                message.status = 2;
                break;
            case "DISMISSED":
            case 3:
                message.status = 3;
                break;
            }
            return message;
        };

        /**
         * Creates a plain object from a AISuggestion message. Also converts values to other types if specified.
         * @function toObject
         * @memberof archcanvas.AISuggestion
         * @static
         * @param {archcanvas.AISuggestion} message AISuggestion
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        AISuggestion.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.id = "";
                object.targetNodeId = "";
                object.targetEdgeId = "";
                object.suggestionType = "";
                object.content = "";
                object.status = options.enums === String ? "NONE" : 0;
            }
            if (message.id != null && message.hasOwnProperty("id"))
                object.id = message.id;
            if (message.targetNodeId != null && message.hasOwnProperty("targetNodeId"))
                object.targetNodeId = message.targetNodeId;
            if (message.targetEdgeId != null && message.hasOwnProperty("targetEdgeId"))
                object.targetEdgeId = message.targetEdgeId;
            if (message.suggestionType != null && message.hasOwnProperty("suggestionType"))
                object.suggestionType = message.suggestionType;
            if (message.content != null && message.hasOwnProperty("content"))
                object.content = message.content;
            if (message.status != null && message.hasOwnProperty("status"))
                object.status = options.enums === String ? $root.archcanvas.Note.NoteStatus[message.status] === undefined ? message.status : $root.archcanvas.Note.NoteStatus[message.status] : message.status;
            return object;
        };

        /**
         * Converts this AISuggestion to JSON.
         * @function toJSON
         * @memberof archcanvas.AISuggestion
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        AISuggestion.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for AISuggestion
         * @function getTypeUrl
         * @memberof archcanvas.AISuggestion
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        AISuggestion.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/archcanvas.AISuggestion";
        };

        return AISuggestion;
    })();

    archcanvas.UndoHistory = (function() {

        /**
         * Properties of an UndoHistory.
         * @memberof archcanvas
         * @interface IUndoHistory
         * @property {Array.<archcanvas.IUndoEntry>|null} [entries] UndoHistory entries
         * @property {number|null} [currentIndex] UndoHistory currentIndex
         * @property {number|null} [maxEntries] UndoHistory maxEntries
         */

        /**
         * Constructs a new UndoHistory.
         * @memberof archcanvas
         * @classdesc Represents an UndoHistory.
         * @implements IUndoHistory
         * @constructor
         * @param {archcanvas.IUndoHistory=} [properties] Properties to set
         */
        function UndoHistory(properties) {
            this.entries = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * UndoHistory entries.
         * @member {Array.<archcanvas.IUndoEntry>} entries
         * @memberof archcanvas.UndoHistory
         * @instance
         */
        UndoHistory.prototype.entries = $util.emptyArray;

        /**
         * UndoHistory currentIndex.
         * @member {number} currentIndex
         * @memberof archcanvas.UndoHistory
         * @instance
         */
        UndoHistory.prototype.currentIndex = 0;

        /**
         * UndoHistory maxEntries.
         * @member {number} maxEntries
         * @memberof archcanvas.UndoHistory
         * @instance
         */
        UndoHistory.prototype.maxEntries = 0;

        /**
         * Creates a new UndoHistory instance using the specified properties.
         * @function create
         * @memberof archcanvas.UndoHistory
         * @static
         * @param {archcanvas.IUndoHistory=} [properties] Properties to set
         * @returns {archcanvas.UndoHistory} UndoHistory instance
         */
        UndoHistory.create = function create(properties) {
            return new UndoHistory(properties);
        };

        /**
         * Encodes the specified UndoHistory message. Does not implicitly {@link archcanvas.UndoHistory.verify|verify} messages.
         * @function encode
         * @memberof archcanvas.UndoHistory
         * @static
         * @param {archcanvas.IUndoHistory} message UndoHistory message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        UndoHistory.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.entries != null && message.entries.length)
                for (let i = 0; i < message.entries.length; ++i)
                    $root.archcanvas.UndoEntry.encode(message.entries[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
            if (message.currentIndex != null && Object.hasOwnProperty.call(message, "currentIndex"))
                writer.uint32(/* id 2, wireType 0 =*/16).int32(message.currentIndex);
            if (message.maxEntries != null && Object.hasOwnProperty.call(message, "maxEntries"))
                writer.uint32(/* id 3, wireType 0 =*/24).int32(message.maxEntries);
            return writer;
        };

        /**
         * Encodes the specified UndoHistory message, length delimited. Does not implicitly {@link archcanvas.UndoHistory.verify|verify} messages.
         * @function encodeDelimited
         * @memberof archcanvas.UndoHistory
         * @static
         * @param {archcanvas.IUndoHistory} message UndoHistory message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        UndoHistory.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes an UndoHistory message from the specified reader or buffer.
         * @function decode
         * @memberof archcanvas.UndoHistory
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {archcanvas.UndoHistory} UndoHistory
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        UndoHistory.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.archcanvas.UndoHistory();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        if (!(message.entries && message.entries.length))
                            message.entries = [];
                        message.entries.push($root.archcanvas.UndoEntry.decode(reader, reader.uint32()));
                        break;
                    }
                case 2: {
                        message.currentIndex = reader.int32();
                        break;
                    }
                case 3: {
                        message.maxEntries = reader.int32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes an UndoHistory message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof archcanvas.UndoHistory
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {archcanvas.UndoHistory} UndoHistory
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        UndoHistory.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies an UndoHistory message.
         * @function verify
         * @memberof archcanvas.UndoHistory
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        UndoHistory.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.entries != null && message.hasOwnProperty("entries")) {
                if (!Array.isArray(message.entries))
                    return "entries: array expected";
                for (let i = 0; i < message.entries.length; ++i) {
                    let error = $root.archcanvas.UndoEntry.verify(message.entries[i]);
                    if (error)
                        return "entries." + error;
                }
            }
            if (message.currentIndex != null && message.hasOwnProperty("currentIndex"))
                if (!$util.isInteger(message.currentIndex))
                    return "currentIndex: integer expected";
            if (message.maxEntries != null && message.hasOwnProperty("maxEntries"))
                if (!$util.isInteger(message.maxEntries))
                    return "maxEntries: integer expected";
            return null;
        };

        /**
         * Creates an UndoHistory message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof archcanvas.UndoHistory
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {archcanvas.UndoHistory} UndoHistory
         */
        UndoHistory.fromObject = function fromObject(object) {
            if (object instanceof $root.archcanvas.UndoHistory)
                return object;
            let message = new $root.archcanvas.UndoHistory();
            if (object.entries) {
                if (!Array.isArray(object.entries))
                    throw TypeError(".archcanvas.UndoHistory.entries: array expected");
                message.entries = [];
                for (let i = 0; i < object.entries.length; ++i) {
                    if (typeof object.entries[i] !== "object")
                        throw TypeError(".archcanvas.UndoHistory.entries: object expected");
                    message.entries[i] = $root.archcanvas.UndoEntry.fromObject(object.entries[i]);
                }
            }
            if (object.currentIndex != null)
                message.currentIndex = object.currentIndex | 0;
            if (object.maxEntries != null)
                message.maxEntries = object.maxEntries | 0;
            return message;
        };

        /**
         * Creates a plain object from an UndoHistory message. Also converts values to other types if specified.
         * @function toObject
         * @memberof archcanvas.UndoHistory
         * @static
         * @param {archcanvas.UndoHistory} message UndoHistory
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        UndoHistory.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.arrays || options.defaults)
                object.entries = [];
            if (options.defaults) {
                object.currentIndex = 0;
                object.maxEntries = 0;
            }
            if (message.entries && message.entries.length) {
                object.entries = [];
                for (let j = 0; j < message.entries.length; ++j)
                    object.entries[j] = $root.archcanvas.UndoEntry.toObject(message.entries[j], options);
            }
            if (message.currentIndex != null && message.hasOwnProperty("currentIndex"))
                object.currentIndex = message.currentIndex;
            if (message.maxEntries != null && message.hasOwnProperty("maxEntries"))
                object.maxEntries = message.maxEntries;
            return object;
        };

        /**
         * Converts this UndoHistory to JSON.
         * @function toJSON
         * @memberof archcanvas.UndoHistory
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        UndoHistory.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for UndoHistory
         * @function getTypeUrl
         * @memberof archcanvas.UndoHistory
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        UndoHistory.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/archcanvas.UndoHistory";
        };

        return UndoHistory;
    })();

    archcanvas.UndoEntry = (function() {

        /**
         * Properties of an UndoEntry.
         * @memberof archcanvas
         * @interface IUndoEntry
         * @property {string|null} [description] UndoEntry description
         * @property {number|Long|null} [timestampMs] UndoEntry timestampMs
         * @property {Uint8Array|null} [architectureSnapshot] UndoEntry architectureSnapshot
         */

        /**
         * Constructs a new UndoEntry.
         * @memberof archcanvas
         * @classdesc Represents an UndoEntry.
         * @implements IUndoEntry
         * @constructor
         * @param {archcanvas.IUndoEntry=} [properties] Properties to set
         */
        function UndoEntry(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * UndoEntry description.
         * @member {string} description
         * @memberof archcanvas.UndoEntry
         * @instance
         */
        UndoEntry.prototype.description = "";

        /**
         * UndoEntry timestampMs.
         * @member {number|Long} timestampMs
         * @memberof archcanvas.UndoEntry
         * @instance
         */
        UndoEntry.prototype.timestampMs = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * UndoEntry architectureSnapshot.
         * @member {Uint8Array} architectureSnapshot
         * @memberof archcanvas.UndoEntry
         * @instance
         */
        UndoEntry.prototype.architectureSnapshot = $util.newBuffer([]);

        /**
         * Creates a new UndoEntry instance using the specified properties.
         * @function create
         * @memberof archcanvas.UndoEntry
         * @static
         * @param {archcanvas.IUndoEntry=} [properties] Properties to set
         * @returns {archcanvas.UndoEntry} UndoEntry instance
         */
        UndoEntry.create = function create(properties) {
            return new UndoEntry(properties);
        };

        /**
         * Encodes the specified UndoEntry message. Does not implicitly {@link archcanvas.UndoEntry.verify|verify} messages.
         * @function encode
         * @memberof archcanvas.UndoEntry
         * @static
         * @param {archcanvas.IUndoEntry} message UndoEntry message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        UndoEntry.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.description != null && Object.hasOwnProperty.call(message, "description"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.description);
            if (message.timestampMs != null && Object.hasOwnProperty.call(message, "timestampMs"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint64(message.timestampMs);
            if (message.architectureSnapshot != null && Object.hasOwnProperty.call(message, "architectureSnapshot"))
                writer.uint32(/* id 3, wireType 2 =*/26).bytes(message.architectureSnapshot);
            return writer;
        };

        /**
         * Encodes the specified UndoEntry message, length delimited. Does not implicitly {@link archcanvas.UndoEntry.verify|verify} messages.
         * @function encodeDelimited
         * @memberof archcanvas.UndoEntry
         * @static
         * @param {archcanvas.IUndoEntry} message UndoEntry message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        UndoEntry.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes an UndoEntry message from the specified reader or buffer.
         * @function decode
         * @memberof archcanvas.UndoEntry
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {archcanvas.UndoEntry} UndoEntry
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        UndoEntry.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.archcanvas.UndoEntry();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.description = reader.string();
                        break;
                    }
                case 2: {
                        message.timestampMs = reader.uint64();
                        break;
                    }
                case 3: {
                        message.architectureSnapshot = reader.bytes();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes an UndoEntry message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof archcanvas.UndoEntry
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {archcanvas.UndoEntry} UndoEntry
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        UndoEntry.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies an UndoEntry message.
         * @function verify
         * @memberof archcanvas.UndoEntry
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        UndoEntry.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.description != null && message.hasOwnProperty("description"))
                if (!$util.isString(message.description))
                    return "description: string expected";
            if (message.timestampMs != null && message.hasOwnProperty("timestampMs"))
                if (!$util.isInteger(message.timestampMs) && !(message.timestampMs && $util.isInteger(message.timestampMs.low) && $util.isInteger(message.timestampMs.high)))
                    return "timestampMs: integer|Long expected";
            if (message.architectureSnapshot != null && message.hasOwnProperty("architectureSnapshot"))
                if (!(message.architectureSnapshot && typeof message.architectureSnapshot.length === "number" || $util.isString(message.architectureSnapshot)))
                    return "architectureSnapshot: buffer expected";
            return null;
        };

        /**
         * Creates an UndoEntry message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof archcanvas.UndoEntry
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {archcanvas.UndoEntry} UndoEntry
         */
        UndoEntry.fromObject = function fromObject(object) {
            if (object instanceof $root.archcanvas.UndoEntry)
                return object;
            let message = new $root.archcanvas.UndoEntry();
            if (object.description != null)
                message.description = String(object.description);
            if (object.timestampMs != null)
                if ($util.Long)
                    (message.timestampMs = $util.Long.fromValue(object.timestampMs)).unsigned = true;
                else if (typeof object.timestampMs === "string")
                    message.timestampMs = parseInt(object.timestampMs, 10);
                else if (typeof object.timestampMs === "number")
                    message.timestampMs = object.timestampMs;
                else if (typeof object.timestampMs === "object")
                    message.timestampMs = new $util.LongBits(object.timestampMs.low >>> 0, object.timestampMs.high >>> 0).toNumber(true);
            if (object.architectureSnapshot != null)
                if (typeof object.architectureSnapshot === "string")
                    $util.base64.decode(object.architectureSnapshot, message.architectureSnapshot = $util.newBuffer($util.base64.length(object.architectureSnapshot)), 0);
                else if (object.architectureSnapshot.length >= 0)
                    message.architectureSnapshot = object.architectureSnapshot;
            return message;
        };

        /**
         * Creates a plain object from an UndoEntry message. Also converts values to other types if specified.
         * @function toObject
         * @memberof archcanvas.UndoEntry
         * @static
         * @param {archcanvas.UndoEntry} message UndoEntry
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        UndoEntry.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.description = "";
                if ($util.Long) {
                    let long = new $util.Long(0, 0, true);
                    object.timestampMs = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.timestampMs = options.longs === String ? "0" : 0;
                if (options.bytes === String)
                    object.architectureSnapshot = "";
                else {
                    object.architectureSnapshot = [];
                    if (options.bytes !== Array)
                        object.architectureSnapshot = $util.newBuffer(object.architectureSnapshot);
                }
            }
            if (message.description != null && message.hasOwnProperty("description"))
                object.description = message.description;
            if (message.timestampMs != null && message.hasOwnProperty("timestampMs"))
                if (typeof message.timestampMs === "number")
                    object.timestampMs = options.longs === String ? String(message.timestampMs) : message.timestampMs;
                else
                    object.timestampMs = options.longs === String ? $util.Long.prototype.toString.call(message.timestampMs) : options.longs === Number ? new $util.LongBits(message.timestampMs.low >>> 0, message.timestampMs.high >>> 0).toNumber(true) : message.timestampMs;
            if (message.architectureSnapshot != null && message.hasOwnProperty("architectureSnapshot"))
                object.architectureSnapshot = options.bytes === String ? $util.base64.encode(message.architectureSnapshot, 0, message.architectureSnapshot.length) : options.bytes === Array ? Array.prototype.slice.call(message.architectureSnapshot) : message.architectureSnapshot;
            return object;
        };

        /**
         * Converts this UndoEntry to JSON.
         * @function toJSON
         * @memberof archcanvas.UndoEntry
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        UndoEntry.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for UndoEntry
         * @function getTypeUrl
         * @memberof archcanvas.UndoEntry
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        UndoEntry.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/archcanvas.UndoEntry";
        };

        return UndoEntry;
    })();

    archcanvas.Value = (function() {

        /**
         * Properties of a Value.
         * @memberof archcanvas
         * @interface IValue
         * @property {string|null} [stringValue] Value stringValue
         * @property {number|null} [numberValue] Value numberValue
         * @property {boolean|null} [boolValue] Value boolValue
         * @property {archcanvas.IStringList|null} [stringListValue] Value stringListValue
         */

        /**
         * Constructs a new Value.
         * @memberof archcanvas
         * @classdesc Represents a Value.
         * @implements IValue
         * @constructor
         * @param {archcanvas.IValue=} [properties] Properties to set
         */
        function Value(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Value stringValue.
         * @member {string|null|undefined} stringValue
         * @memberof archcanvas.Value
         * @instance
         */
        Value.prototype.stringValue = null;

        /**
         * Value numberValue.
         * @member {number|null|undefined} numberValue
         * @memberof archcanvas.Value
         * @instance
         */
        Value.prototype.numberValue = null;

        /**
         * Value boolValue.
         * @member {boolean|null|undefined} boolValue
         * @memberof archcanvas.Value
         * @instance
         */
        Value.prototype.boolValue = null;

        /**
         * Value stringListValue.
         * @member {archcanvas.IStringList|null|undefined} stringListValue
         * @memberof archcanvas.Value
         * @instance
         */
        Value.prototype.stringListValue = null;

        // OneOf field names bound to virtual getters and setters
        let $oneOfFields;

        /**
         * Value kind.
         * @member {"stringValue"|"numberValue"|"boolValue"|"stringListValue"|undefined} kind
         * @memberof archcanvas.Value
         * @instance
         */
        Object.defineProperty(Value.prototype, "kind", {
            get: $util.oneOfGetter($oneOfFields = ["stringValue", "numberValue", "boolValue", "stringListValue"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new Value instance using the specified properties.
         * @function create
         * @memberof archcanvas.Value
         * @static
         * @param {archcanvas.IValue=} [properties] Properties to set
         * @returns {archcanvas.Value} Value instance
         */
        Value.create = function create(properties) {
            return new Value(properties);
        };

        /**
         * Encodes the specified Value message. Does not implicitly {@link archcanvas.Value.verify|verify} messages.
         * @function encode
         * @memberof archcanvas.Value
         * @static
         * @param {archcanvas.IValue} message Value message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Value.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.stringValue != null && Object.hasOwnProperty.call(message, "stringValue"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.stringValue);
            if (message.numberValue != null && Object.hasOwnProperty.call(message, "numberValue"))
                writer.uint32(/* id 2, wireType 1 =*/17).double(message.numberValue);
            if (message.boolValue != null && Object.hasOwnProperty.call(message, "boolValue"))
                writer.uint32(/* id 3, wireType 0 =*/24).bool(message.boolValue);
            if (message.stringListValue != null && Object.hasOwnProperty.call(message, "stringListValue"))
                $root.archcanvas.StringList.encode(message.stringListValue, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified Value message, length delimited. Does not implicitly {@link archcanvas.Value.verify|verify} messages.
         * @function encodeDelimited
         * @memberof archcanvas.Value
         * @static
         * @param {archcanvas.IValue} message Value message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Value.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a Value message from the specified reader or buffer.
         * @function decode
         * @memberof archcanvas.Value
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {archcanvas.Value} Value
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Value.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.archcanvas.Value();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.stringValue = reader.string();
                        break;
                    }
                case 2: {
                        message.numberValue = reader.double();
                        break;
                    }
                case 3: {
                        message.boolValue = reader.bool();
                        break;
                    }
                case 4: {
                        message.stringListValue = $root.archcanvas.StringList.decode(reader, reader.uint32());
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a Value message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof archcanvas.Value
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {archcanvas.Value} Value
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Value.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a Value message.
         * @function verify
         * @memberof archcanvas.Value
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Value.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            let properties = {};
            if (message.stringValue != null && message.hasOwnProperty("stringValue")) {
                properties.kind = 1;
                if (!$util.isString(message.stringValue))
                    return "stringValue: string expected";
            }
            if (message.numberValue != null && message.hasOwnProperty("numberValue")) {
                if (properties.kind === 1)
                    return "kind: multiple values";
                properties.kind = 1;
                if (typeof message.numberValue !== "number")
                    return "numberValue: number expected";
            }
            if (message.boolValue != null && message.hasOwnProperty("boolValue")) {
                if (properties.kind === 1)
                    return "kind: multiple values";
                properties.kind = 1;
                if (typeof message.boolValue !== "boolean")
                    return "boolValue: boolean expected";
            }
            if (message.stringListValue != null && message.hasOwnProperty("stringListValue")) {
                if (properties.kind === 1)
                    return "kind: multiple values";
                properties.kind = 1;
                {
                    let error = $root.archcanvas.StringList.verify(message.stringListValue);
                    if (error)
                        return "stringListValue." + error;
                }
            }
            return null;
        };

        /**
         * Creates a Value message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof archcanvas.Value
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {archcanvas.Value} Value
         */
        Value.fromObject = function fromObject(object) {
            if (object instanceof $root.archcanvas.Value)
                return object;
            let message = new $root.archcanvas.Value();
            if (object.stringValue != null)
                message.stringValue = String(object.stringValue);
            if (object.numberValue != null)
                message.numberValue = Number(object.numberValue);
            if (object.boolValue != null)
                message.boolValue = Boolean(object.boolValue);
            if (object.stringListValue != null) {
                if (typeof object.stringListValue !== "object")
                    throw TypeError(".archcanvas.Value.stringListValue: object expected");
                message.stringListValue = $root.archcanvas.StringList.fromObject(object.stringListValue);
            }
            return message;
        };

        /**
         * Creates a plain object from a Value message. Also converts values to other types if specified.
         * @function toObject
         * @memberof archcanvas.Value
         * @static
         * @param {archcanvas.Value} message Value
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Value.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (message.stringValue != null && message.hasOwnProperty("stringValue")) {
                object.stringValue = message.stringValue;
                if (options.oneofs)
                    object.kind = "stringValue";
            }
            if (message.numberValue != null && message.hasOwnProperty("numberValue")) {
                object.numberValue = options.json && !isFinite(message.numberValue) ? String(message.numberValue) : message.numberValue;
                if (options.oneofs)
                    object.kind = "numberValue";
            }
            if (message.boolValue != null && message.hasOwnProperty("boolValue")) {
                object.boolValue = message.boolValue;
                if (options.oneofs)
                    object.kind = "boolValue";
            }
            if (message.stringListValue != null && message.hasOwnProperty("stringListValue")) {
                object.stringListValue = $root.archcanvas.StringList.toObject(message.stringListValue, options);
                if (options.oneofs)
                    object.kind = "stringListValue";
            }
            return object;
        };

        /**
         * Converts this Value to JSON.
         * @function toJSON
         * @memberof archcanvas.Value
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Value.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for Value
         * @function getTypeUrl
         * @memberof archcanvas.Value
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Value.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/archcanvas.Value";
        };

        return Value;
    })();

    archcanvas.StringList = (function() {

        /**
         * Properties of a StringList.
         * @memberof archcanvas
         * @interface IStringList
         * @property {Array.<string>|null} [values] StringList values
         */

        /**
         * Constructs a new StringList.
         * @memberof archcanvas
         * @classdesc Represents a StringList.
         * @implements IStringList
         * @constructor
         * @param {archcanvas.IStringList=} [properties] Properties to set
         */
        function StringList(properties) {
            this.values = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * StringList values.
         * @member {Array.<string>} values
         * @memberof archcanvas.StringList
         * @instance
         */
        StringList.prototype.values = $util.emptyArray;

        /**
         * Creates a new StringList instance using the specified properties.
         * @function create
         * @memberof archcanvas.StringList
         * @static
         * @param {archcanvas.IStringList=} [properties] Properties to set
         * @returns {archcanvas.StringList} StringList instance
         */
        StringList.create = function create(properties) {
            return new StringList(properties);
        };

        /**
         * Encodes the specified StringList message. Does not implicitly {@link archcanvas.StringList.verify|verify} messages.
         * @function encode
         * @memberof archcanvas.StringList
         * @static
         * @param {archcanvas.IStringList} message StringList message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        StringList.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.values != null && message.values.length)
                for (let i = 0; i < message.values.length; ++i)
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.values[i]);
            return writer;
        };

        /**
         * Encodes the specified StringList message, length delimited. Does not implicitly {@link archcanvas.StringList.verify|verify} messages.
         * @function encodeDelimited
         * @memberof archcanvas.StringList
         * @static
         * @param {archcanvas.IStringList} message StringList message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        StringList.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a StringList message from the specified reader or buffer.
         * @function decode
         * @memberof archcanvas.StringList
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {archcanvas.StringList} StringList
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        StringList.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.archcanvas.StringList();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        if (!(message.values && message.values.length))
                            message.values = [];
                        message.values.push(reader.string());
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a StringList message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof archcanvas.StringList
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {archcanvas.StringList} StringList
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        StringList.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a StringList message.
         * @function verify
         * @memberof archcanvas.StringList
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        StringList.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.values != null && message.hasOwnProperty("values")) {
                if (!Array.isArray(message.values))
                    return "values: array expected";
                for (let i = 0; i < message.values.length; ++i)
                    if (!$util.isString(message.values[i]))
                        return "values: string[] expected";
            }
            return null;
        };

        /**
         * Creates a StringList message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof archcanvas.StringList
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {archcanvas.StringList} StringList
         */
        StringList.fromObject = function fromObject(object) {
            if (object instanceof $root.archcanvas.StringList)
                return object;
            let message = new $root.archcanvas.StringList();
            if (object.values) {
                if (!Array.isArray(object.values))
                    throw TypeError(".archcanvas.StringList.values: array expected");
                message.values = [];
                for (let i = 0; i < object.values.length; ++i)
                    message.values[i] = String(object.values[i]);
            }
            return message;
        };

        /**
         * Creates a plain object from a StringList message. Also converts values to other types if specified.
         * @function toObject
         * @memberof archcanvas.StringList
         * @static
         * @param {archcanvas.StringList} message StringList
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        StringList.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.arrays || options.defaults)
                object.values = [];
            if (message.values && message.values.length) {
                object.values = [];
                for (let j = 0; j < message.values.length; ++j)
                    object.values[j] = message.values[j];
            }
            return object;
        };

        /**
         * Converts this StringList to JSON.
         * @function toJSON
         * @memberof archcanvas.StringList
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        StringList.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for StringList
         * @function getTypeUrl
         * @memberof archcanvas.StringList
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        StringList.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/archcanvas.StringList";
        };

        return StringList;
    })();

    return archcanvas;
})();

export { $root as default };
