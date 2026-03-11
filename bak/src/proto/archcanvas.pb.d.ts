import * as $protobuf from "protobufjs";
import Long = require("long");
/** Namespace archcanvas. */
export namespace archcanvas {

    /** Properties of an ArchCanvasFile. */
    interface IArchCanvasFile {

        /** ArchCanvasFile header */
        header?: (archcanvas.IFileHeader|null);

        /** ArchCanvasFile architecture */
        architecture?: (archcanvas.IArchitecture|null);

        /** ArchCanvasFile canvasState */
        canvasState?: (archcanvas.ICanvasState|null);

        /** ArchCanvasFile aiState */
        aiState?: (archcanvas.IAIState|null);

        /** ArchCanvasFile undoHistory */
        undoHistory?: (archcanvas.IUndoHistory|null);
    }

    /** Represents an ArchCanvasFile. */
    class ArchCanvasFile implements IArchCanvasFile {

        /**
         * Constructs a new ArchCanvasFile.
         * @param [properties] Properties to set
         */
        constructor(properties?: archcanvas.IArchCanvasFile);

        /** ArchCanvasFile header. */
        public header?: (archcanvas.IFileHeader|null);

        /** ArchCanvasFile architecture. */
        public architecture?: (archcanvas.IArchitecture|null);

        /** ArchCanvasFile canvasState. */
        public canvasState?: (archcanvas.ICanvasState|null);

        /** ArchCanvasFile aiState. */
        public aiState?: (archcanvas.IAIState|null);

        /** ArchCanvasFile undoHistory. */
        public undoHistory?: (archcanvas.IUndoHistory|null);

        /**
         * Creates a new ArchCanvasFile instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ArchCanvasFile instance
         */
        public static create(properties?: archcanvas.IArchCanvasFile): archcanvas.ArchCanvasFile;

        /**
         * Encodes the specified ArchCanvasFile message. Does not implicitly {@link archcanvas.ArchCanvasFile.verify|verify} messages.
         * @param message ArchCanvasFile message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: archcanvas.IArchCanvasFile, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified ArchCanvasFile message, length delimited. Does not implicitly {@link archcanvas.ArchCanvasFile.verify|verify} messages.
         * @param message ArchCanvasFile message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: archcanvas.IArchCanvasFile, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an ArchCanvasFile message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ArchCanvasFile
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): archcanvas.ArchCanvasFile;

        /**
         * Decodes an ArchCanvasFile message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ArchCanvasFile
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): archcanvas.ArchCanvasFile;

        /**
         * Verifies an ArchCanvasFile message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an ArchCanvasFile message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ArchCanvasFile
         */
        public static fromObject(object: { [k: string]: any }): archcanvas.ArchCanvasFile;

        /**
         * Creates a plain object from an ArchCanvasFile message. Also converts values to other types if specified.
         * @param message ArchCanvasFile
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: archcanvas.ArchCanvasFile, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this ArchCanvasFile to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ArchCanvasFile
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a FileHeader. */
    interface IFileHeader {

        /** FileHeader formatVersion */
        formatVersion?: (number|null);

        /** FileHeader toolVersion */
        toolVersion?: (string|null);

        /** FileHeader createdAtMs */
        createdAtMs?: (number|Long|null);

        /** FileHeader updatedAtMs */
        updatedAtMs?: (number|Long|null);

        /** FileHeader checksumSha256 */
        checksumSha256?: (Uint8Array|null);
    }

    /** Represents a FileHeader. */
    class FileHeader implements IFileHeader {

        /**
         * Constructs a new FileHeader.
         * @param [properties] Properties to set
         */
        constructor(properties?: archcanvas.IFileHeader);

        /** FileHeader formatVersion. */
        public formatVersion: number;

        /** FileHeader toolVersion. */
        public toolVersion: string;

        /** FileHeader createdAtMs. */
        public createdAtMs: (number|Long);

        /** FileHeader updatedAtMs. */
        public updatedAtMs: (number|Long);

        /** FileHeader checksumSha256. */
        public checksumSha256: Uint8Array;

        /**
         * Creates a new FileHeader instance using the specified properties.
         * @param [properties] Properties to set
         * @returns FileHeader instance
         */
        public static create(properties?: archcanvas.IFileHeader): archcanvas.FileHeader;

        /**
         * Encodes the specified FileHeader message. Does not implicitly {@link archcanvas.FileHeader.verify|verify} messages.
         * @param message FileHeader message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: archcanvas.IFileHeader, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified FileHeader message, length delimited. Does not implicitly {@link archcanvas.FileHeader.verify|verify} messages.
         * @param message FileHeader message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: archcanvas.IFileHeader, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a FileHeader message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns FileHeader
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): archcanvas.FileHeader;

        /**
         * Decodes a FileHeader message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns FileHeader
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): archcanvas.FileHeader;

        /**
         * Verifies a FileHeader message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a FileHeader message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns FileHeader
         */
        public static fromObject(object: { [k: string]: any }): archcanvas.FileHeader;

        /**
         * Creates a plain object from a FileHeader message. Also converts values to other types if specified.
         * @param message FileHeader
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: archcanvas.FileHeader, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this FileHeader to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for FileHeader
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an Architecture. */
    interface IArchitecture {

        /** Architecture name */
        name?: (string|null);

        /** Architecture description */
        description?: (string|null);

        /** Architecture owners */
        owners?: (string[]|null);

        /** Architecture nodes */
        nodes?: (archcanvas.INode[]|null);

        /** Architecture edges */
        edges?: (archcanvas.IEdge[]|null);

        /** Architecture annotations */
        annotations?: (archcanvas.IAnnotation[]|null);
    }

    /** Represents an Architecture. */
    class Architecture implements IArchitecture {

        /**
         * Constructs a new Architecture.
         * @param [properties] Properties to set
         */
        constructor(properties?: archcanvas.IArchitecture);

        /** Architecture name. */
        public name: string;

        /** Architecture description. */
        public description: string;

        /** Architecture owners. */
        public owners: string[];

        /** Architecture nodes. */
        public nodes: archcanvas.INode[];

        /** Architecture edges. */
        public edges: archcanvas.IEdge[];

        /** Architecture annotations. */
        public annotations: archcanvas.IAnnotation[];

        /**
         * Creates a new Architecture instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Architecture instance
         */
        public static create(properties?: archcanvas.IArchitecture): archcanvas.Architecture;

        /**
         * Encodes the specified Architecture message. Does not implicitly {@link archcanvas.Architecture.verify|verify} messages.
         * @param message Architecture message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: archcanvas.IArchitecture, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Architecture message, length delimited. Does not implicitly {@link archcanvas.Architecture.verify|verify} messages.
         * @param message Architecture message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: archcanvas.IArchitecture, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an Architecture message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Architecture
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): archcanvas.Architecture;

        /**
         * Decodes an Architecture message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Architecture
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): archcanvas.Architecture;

        /**
         * Verifies an Architecture message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an Architecture message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Architecture
         */
        public static fromObject(object: { [k: string]: any }): archcanvas.Architecture;

        /**
         * Creates a plain object from an Architecture message. Also converts values to other types if specified.
         * @param message Architecture
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: archcanvas.Architecture, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Architecture to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Architecture
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an Annotation. */
    interface IAnnotation {

        /** Annotation id */
        id?: (string|null);

        /** Annotation paths */
        paths?: (archcanvas.IAnnotationPath[]|null);

        /** Annotation color */
        color?: (string|null);

        /** Annotation strokeWidth */
        strokeWidth?: (number|null);

        /** Annotation nodeId */
        nodeId?: (string|null);

        /** Annotation timestampMs */
        timestampMs?: (number|Long|null);
    }

    /** Represents an Annotation. */
    class Annotation implements IAnnotation {

        /**
         * Constructs a new Annotation.
         * @param [properties] Properties to set
         */
        constructor(properties?: archcanvas.IAnnotation);

        /** Annotation id. */
        public id: string;

        /** Annotation paths. */
        public paths: archcanvas.IAnnotationPath[];

        /** Annotation color. */
        public color: string;

        /** Annotation strokeWidth. */
        public strokeWidth: number;

        /** Annotation nodeId. */
        public nodeId: string;

        /** Annotation timestampMs. */
        public timestampMs: (number|Long);

        /**
         * Creates a new Annotation instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Annotation instance
         */
        public static create(properties?: archcanvas.IAnnotation): archcanvas.Annotation;

        /**
         * Encodes the specified Annotation message. Does not implicitly {@link archcanvas.Annotation.verify|verify} messages.
         * @param message Annotation message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: archcanvas.IAnnotation, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Annotation message, length delimited. Does not implicitly {@link archcanvas.Annotation.verify|verify} messages.
         * @param message Annotation message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: archcanvas.IAnnotation, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an Annotation message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Annotation
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): archcanvas.Annotation;

        /**
         * Decodes an Annotation message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Annotation
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): archcanvas.Annotation;

        /**
         * Verifies an Annotation message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an Annotation message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Annotation
         */
        public static fromObject(object: { [k: string]: any }): archcanvas.Annotation;

        /**
         * Creates a plain object from an Annotation message. Also converts values to other types if specified.
         * @param message Annotation
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: archcanvas.Annotation, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Annotation to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Annotation
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an AnnotationPath. */
    interface IAnnotationPath {

        /** AnnotationPath points */
        points?: (number[]|null);

        /** AnnotationPath pressures */
        pressures?: (number[]|null);
    }

    /** Represents an AnnotationPath. */
    class AnnotationPath implements IAnnotationPath {

        /**
         * Constructs a new AnnotationPath.
         * @param [properties] Properties to set
         */
        constructor(properties?: archcanvas.IAnnotationPath);

        /** AnnotationPath points. */
        public points: number[];

        /** AnnotationPath pressures. */
        public pressures: number[];

        /**
         * Creates a new AnnotationPath instance using the specified properties.
         * @param [properties] Properties to set
         * @returns AnnotationPath instance
         */
        public static create(properties?: archcanvas.IAnnotationPath): archcanvas.AnnotationPath;

        /**
         * Encodes the specified AnnotationPath message. Does not implicitly {@link archcanvas.AnnotationPath.verify|verify} messages.
         * @param message AnnotationPath message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: archcanvas.IAnnotationPath, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified AnnotationPath message, length delimited. Does not implicitly {@link archcanvas.AnnotationPath.verify|verify} messages.
         * @param message AnnotationPath message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: archcanvas.IAnnotationPath, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an AnnotationPath message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns AnnotationPath
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): archcanvas.AnnotationPath;

        /**
         * Decodes an AnnotationPath message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns AnnotationPath
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): archcanvas.AnnotationPath;

        /**
         * Verifies an AnnotationPath message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an AnnotationPath message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns AnnotationPath
         */
        public static fromObject(object: { [k: string]: any }): archcanvas.AnnotationPath;

        /**
         * Creates a plain object from an AnnotationPath message. Also converts values to other types if specified.
         * @param message AnnotationPath
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: archcanvas.AnnotationPath, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this AnnotationPath to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for AnnotationPath
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Node. */
    interface INode {

        /** Node id */
        id?: (string|null);

        /** Node type */
        type?: (string|null);

        /** Node displayName */
        displayName?: (string|null);

        /** Node args */
        args?: ({ [k: string]: archcanvas.IValue }|null);

        /** Node codeRefs */
        codeRefs?: (archcanvas.ICodeRef[]|null);

        /** Node notes */
        notes?: (archcanvas.INote[]|null);

        /** Node properties */
        properties?: ({ [k: string]: archcanvas.IValue }|null);

        /** Node position */
        position?: (archcanvas.IPosition|null);

        /** Node children */
        children?: (archcanvas.INode[]|null);

        /** Node refSource */
        refSource?: (string|null);
    }

    /** Represents a Node. */
    class Node implements INode {

        /**
         * Constructs a new Node.
         * @param [properties] Properties to set
         */
        constructor(properties?: archcanvas.INode);

        /** Node id. */
        public id: string;

        /** Node type. */
        public type: string;

        /** Node displayName. */
        public displayName: string;

        /** Node args. */
        public args: { [k: string]: archcanvas.IValue };

        /** Node codeRefs. */
        public codeRefs: archcanvas.ICodeRef[];

        /** Node notes. */
        public notes: archcanvas.INote[];

        /** Node properties. */
        public properties: { [k: string]: archcanvas.IValue };

        /** Node position. */
        public position?: (archcanvas.IPosition|null);

        /** Node children. */
        public children: archcanvas.INode[];

        /** Node refSource. */
        public refSource: string;

        /**
         * Creates a new Node instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Node instance
         */
        public static create(properties?: archcanvas.INode): archcanvas.Node;

        /**
         * Encodes the specified Node message. Does not implicitly {@link archcanvas.Node.verify|verify} messages.
         * @param message Node message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: archcanvas.INode, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Node message, length delimited. Does not implicitly {@link archcanvas.Node.verify|verify} messages.
         * @param message Node message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: archcanvas.INode, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Node message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Node
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): archcanvas.Node;

        /**
         * Decodes a Node message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Node
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): archcanvas.Node;

        /**
         * Verifies a Node message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Node message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Node
         */
        public static fromObject(object: { [k: string]: any }): archcanvas.Node;

        /**
         * Creates a plain object from a Node message. Also converts values to other types if specified.
         * @param message Node
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: archcanvas.Node, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Node to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Node
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an Edge. */
    interface IEdge {

        /** Edge id */
        id?: (string|null);

        /** Edge fromNode */
        fromNode?: (string|null);

        /** Edge toNode */
        toNode?: (string|null);

        /** Edge fromPort */
        fromPort?: (string|null);

        /** Edge toPort */
        toPort?: (string|null);

        /** Edge type */
        type?: (archcanvas.Edge.EdgeType|null);

        /** Edge label */
        label?: (string|null);

        /** Edge properties */
        properties?: ({ [k: string]: archcanvas.IValue }|null);

        /** Edge notes */
        notes?: (archcanvas.INote[]|null);
    }

    /** Represents an Edge. */
    class Edge implements IEdge {

        /**
         * Constructs a new Edge.
         * @param [properties] Properties to set
         */
        constructor(properties?: archcanvas.IEdge);

        /** Edge id. */
        public id: string;

        /** Edge fromNode. */
        public fromNode: string;

        /** Edge toNode. */
        public toNode: string;

        /** Edge fromPort. */
        public fromPort: string;

        /** Edge toPort. */
        public toPort: string;

        /** Edge type. */
        public type: archcanvas.Edge.EdgeType;

        /** Edge label. */
        public label: string;

        /** Edge properties. */
        public properties: { [k: string]: archcanvas.IValue };

        /** Edge notes. */
        public notes: archcanvas.INote[];

        /**
         * Creates a new Edge instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Edge instance
         */
        public static create(properties?: archcanvas.IEdge): archcanvas.Edge;

        /**
         * Encodes the specified Edge message. Does not implicitly {@link archcanvas.Edge.verify|verify} messages.
         * @param message Edge message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: archcanvas.IEdge, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Edge message, length delimited. Does not implicitly {@link archcanvas.Edge.verify|verify} messages.
         * @param message Edge message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: archcanvas.IEdge, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an Edge message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Edge
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): archcanvas.Edge;

        /**
         * Decodes an Edge message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Edge
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): archcanvas.Edge;

        /**
         * Verifies an Edge message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an Edge message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Edge
         */
        public static fromObject(object: { [k: string]: any }): archcanvas.Edge;

        /**
         * Creates a plain object from an Edge message. Also converts values to other types if specified.
         * @param message Edge
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: archcanvas.Edge, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Edge to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Edge
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    namespace Edge {

        /** EdgeType enum. */
        enum EdgeType {
            SYNC = 0,
            ASYNC = 1,
            DATA_FLOW = 2
        }
    }

    /** Properties of a Note. */
    interface INote {

        /** Note id */
        id?: (string|null);

        /** Note author */
        author?: (string|null);

        /** Note timestampMs */
        timestampMs?: (number|Long|null);

        /** Note content */
        content?: (string|null);

        /** Note tags */
        tags?: (string[]|null);

        /** Note status */
        status?: (archcanvas.Note.NoteStatus|null);

        /** Note suggestionType */
        suggestionType?: (string|null);
    }

    /** Represents a Note. */
    class Note implements INote {

        /**
         * Constructs a new Note.
         * @param [properties] Properties to set
         */
        constructor(properties?: archcanvas.INote);

        /** Note id. */
        public id: string;

        /** Note author. */
        public author: string;

        /** Note timestampMs. */
        public timestampMs: (number|Long);

        /** Note content. */
        public content: string;

        /** Note tags. */
        public tags: string[];

        /** Note status. */
        public status: archcanvas.Note.NoteStatus;

        /** Note suggestionType. */
        public suggestionType: string;

        /**
         * Creates a new Note instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Note instance
         */
        public static create(properties?: archcanvas.INote): archcanvas.Note;

        /**
         * Encodes the specified Note message. Does not implicitly {@link archcanvas.Note.verify|verify} messages.
         * @param message Note message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: archcanvas.INote, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Note message, length delimited. Does not implicitly {@link archcanvas.Note.verify|verify} messages.
         * @param message Note message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: archcanvas.INote, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Note message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Note
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): archcanvas.Note;

        /**
         * Decodes a Note message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Note
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): archcanvas.Note;

        /**
         * Verifies a Note message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Note message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Note
         */
        public static fromObject(object: { [k: string]: any }): archcanvas.Note;

        /**
         * Creates a plain object from a Note message. Also converts values to other types if specified.
         * @param message Note
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: archcanvas.Note, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Note to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Note
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    namespace Note {

        /** NoteStatus enum. */
        enum NoteStatus {
            NONE = 0,
            PENDING = 1,
            ACCEPTED = 2,
            DISMISSED = 3
        }
    }

    /** Properties of a CodeRef. */
    interface ICodeRef {

        /** CodeRef path */
        path?: (string|null);

        /** CodeRef role */
        role?: (archcanvas.CodeRef.CodeRefRole|null);
    }

    /** Represents a CodeRef. */
    class CodeRef implements ICodeRef {

        /**
         * Constructs a new CodeRef.
         * @param [properties] Properties to set
         */
        constructor(properties?: archcanvas.ICodeRef);

        /** CodeRef path. */
        public path: string;

        /** CodeRef role. */
        public role: archcanvas.CodeRef.CodeRefRole;

        /**
         * Creates a new CodeRef instance using the specified properties.
         * @param [properties] Properties to set
         * @returns CodeRef instance
         */
        public static create(properties?: archcanvas.ICodeRef): archcanvas.CodeRef;

        /**
         * Encodes the specified CodeRef message. Does not implicitly {@link archcanvas.CodeRef.verify|verify} messages.
         * @param message CodeRef message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: archcanvas.ICodeRef, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified CodeRef message, length delimited. Does not implicitly {@link archcanvas.CodeRef.verify|verify} messages.
         * @param message CodeRef message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: archcanvas.ICodeRef, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a CodeRef message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns CodeRef
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): archcanvas.CodeRef;

        /**
         * Decodes a CodeRef message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns CodeRef
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): archcanvas.CodeRef;

        /**
         * Verifies a CodeRef message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a CodeRef message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns CodeRef
         */
        public static fromObject(object: { [k: string]: any }): archcanvas.CodeRef;

        /**
         * Creates a plain object from a CodeRef message. Also converts values to other types if specified.
         * @param message CodeRef
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: archcanvas.CodeRef, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this CodeRef to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for CodeRef
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    namespace CodeRef {

        /** CodeRefRole enum. */
        enum CodeRefRole {
            SOURCE = 0,
            API_SPEC = 1,
            SCHEMA = 2,
            DEPLOYMENT = 3,
            CONFIG = 4,
            TEST = 5
        }
    }

    /** Properties of a Position. */
    interface IPosition {

        /** Position x */
        x?: (number|null);

        /** Position y */
        y?: (number|null);

        /** Position width */
        width?: (number|null);

        /** Position height */
        height?: (number|null);

        /** Position color */
        color?: (string|null);
    }

    /** Represents a Position. */
    class Position implements IPosition {

        /**
         * Constructs a new Position.
         * @param [properties] Properties to set
         */
        constructor(properties?: archcanvas.IPosition);

        /** Position x. */
        public x: number;

        /** Position y. */
        public y: number;

        /** Position width. */
        public width: number;

        /** Position height. */
        public height: number;

        /** Position color. */
        public color: string;

        /**
         * Creates a new Position instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Position instance
         */
        public static create(properties?: archcanvas.IPosition): archcanvas.Position;

        /**
         * Encodes the specified Position message. Does not implicitly {@link archcanvas.Position.verify|verify} messages.
         * @param message Position message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: archcanvas.IPosition, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Position message, length delimited. Does not implicitly {@link archcanvas.Position.verify|verify} messages.
         * @param message Position message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: archcanvas.IPosition, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Position message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Position
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): archcanvas.Position;

        /**
         * Decodes a Position message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Position
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): archcanvas.Position;

        /**
         * Verifies a Position message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Position message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Position
         */
        public static fromObject(object: { [k: string]: any }): archcanvas.Position;

        /**
         * Creates a plain object from a Position message. Also converts values to other types if specified.
         * @param message Position
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: archcanvas.Position, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Position to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Position
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a CanvasState. */
    interface ICanvasState {

        /** CanvasState viewportX */
        viewportX?: (number|null);

        /** CanvasState viewportY */
        viewportY?: (number|null);

        /** CanvasState viewportZoom */
        viewportZoom?: (number|null);

        /** CanvasState selectedNodeIds */
        selectedNodeIds?: (string[]|null);

        /** CanvasState navigationPath */
        navigationPath?: (string[]|null);

        /** CanvasState panelLayout */
        panelLayout?: (archcanvas.IPanelLayout|null);
    }

    /** Represents a CanvasState. */
    class CanvasState implements ICanvasState {

        /**
         * Constructs a new CanvasState.
         * @param [properties] Properties to set
         */
        constructor(properties?: archcanvas.ICanvasState);

        /** CanvasState viewportX. */
        public viewportX: number;

        /** CanvasState viewportY. */
        public viewportY: number;

        /** CanvasState viewportZoom. */
        public viewportZoom: number;

        /** CanvasState selectedNodeIds. */
        public selectedNodeIds: string[];

        /** CanvasState navigationPath. */
        public navigationPath: string[];

        /** CanvasState panelLayout. */
        public panelLayout?: (archcanvas.IPanelLayout|null);

        /**
         * Creates a new CanvasState instance using the specified properties.
         * @param [properties] Properties to set
         * @returns CanvasState instance
         */
        public static create(properties?: archcanvas.ICanvasState): archcanvas.CanvasState;

        /**
         * Encodes the specified CanvasState message. Does not implicitly {@link archcanvas.CanvasState.verify|verify} messages.
         * @param message CanvasState message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: archcanvas.ICanvasState, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified CanvasState message, length delimited. Does not implicitly {@link archcanvas.CanvasState.verify|verify} messages.
         * @param message CanvasState message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: archcanvas.ICanvasState, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a CanvasState message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns CanvasState
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): archcanvas.CanvasState;

        /**
         * Decodes a CanvasState message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns CanvasState
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): archcanvas.CanvasState;

        /**
         * Verifies a CanvasState message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a CanvasState message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns CanvasState
         */
        public static fromObject(object: { [k: string]: any }): archcanvas.CanvasState;

        /**
         * Creates a plain object from a CanvasState message. Also converts values to other types if specified.
         * @param message CanvasState
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: archcanvas.CanvasState, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this CanvasState to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for CanvasState
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a PanelLayout. */
    interface IPanelLayout {

        /** PanelLayout rightPanelOpen */
        rightPanelOpen?: (boolean|null);

        /** PanelLayout rightPanelTab */
        rightPanelTab?: (string|null);

        /** PanelLayout rightPanelWidth */
        rightPanelWidth?: (number|null);
    }

    /** Represents a PanelLayout. */
    class PanelLayout implements IPanelLayout {

        /**
         * Constructs a new PanelLayout.
         * @param [properties] Properties to set
         */
        constructor(properties?: archcanvas.IPanelLayout);

        /** PanelLayout rightPanelOpen. */
        public rightPanelOpen: boolean;

        /** PanelLayout rightPanelTab. */
        public rightPanelTab: string;

        /** PanelLayout rightPanelWidth. */
        public rightPanelWidth: number;

        /**
         * Creates a new PanelLayout instance using the specified properties.
         * @param [properties] Properties to set
         * @returns PanelLayout instance
         */
        public static create(properties?: archcanvas.IPanelLayout): archcanvas.PanelLayout;

        /**
         * Encodes the specified PanelLayout message. Does not implicitly {@link archcanvas.PanelLayout.verify|verify} messages.
         * @param message PanelLayout message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: archcanvas.IPanelLayout, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified PanelLayout message, length delimited. Does not implicitly {@link archcanvas.PanelLayout.verify|verify} messages.
         * @param message PanelLayout message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: archcanvas.IPanelLayout, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a PanelLayout message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns PanelLayout
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): archcanvas.PanelLayout;

        /**
         * Decodes a PanelLayout message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns PanelLayout
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): archcanvas.PanelLayout;

        /**
         * Verifies a PanelLayout message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a PanelLayout message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns PanelLayout
         */
        public static fromObject(object: { [k: string]: any }): archcanvas.PanelLayout;

        /**
         * Creates a plain object from a PanelLayout message. Also converts values to other types if specified.
         * @param message PanelLayout
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: archcanvas.PanelLayout, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this PanelLayout to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for PanelLayout
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a AIState. */
    interface IAIState {

        /** AIState conversations */
        conversations?: (archcanvas.IAIConversation[]|null);
    }

    /** Represents a AIState. */
    class AIState implements IAIState {

        /**
         * Constructs a new AIState.
         * @param [properties] Properties to set
         */
        constructor(properties?: archcanvas.IAIState);

        /** AIState conversations. */
        public conversations: archcanvas.IAIConversation[];

        /**
         * Creates a new AIState instance using the specified properties.
         * @param [properties] Properties to set
         * @returns AIState instance
         */
        public static create(properties?: archcanvas.IAIState): archcanvas.AIState;

        /**
         * Encodes the specified AIState message. Does not implicitly {@link archcanvas.AIState.verify|verify} messages.
         * @param message AIState message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: archcanvas.IAIState, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified AIState message, length delimited. Does not implicitly {@link archcanvas.AIState.verify|verify} messages.
         * @param message AIState message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: archcanvas.IAIState, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a AIState message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns AIState
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): archcanvas.AIState;

        /**
         * Decodes a AIState message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns AIState
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): archcanvas.AIState;

        /**
         * Verifies a AIState message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a AIState message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns AIState
         */
        public static fromObject(object: { [k: string]: any }): archcanvas.AIState;

        /**
         * Creates a plain object from a AIState message. Also converts values to other types if specified.
         * @param message AIState
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: archcanvas.AIState, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this AIState to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for AIState
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a AIConversation. */
    interface IAIConversation {

        /** AIConversation id */
        id?: (string|null);

        /** AIConversation scopedToNodeId */
        scopedToNodeId?: (string|null);

        /** AIConversation messages */
        messages?: (archcanvas.IAIMessage[]|null);

        /** AIConversation createdAtMs */
        createdAtMs?: (number|Long|null);
    }

    /** Represents a AIConversation. */
    class AIConversation implements IAIConversation {

        /**
         * Constructs a new AIConversation.
         * @param [properties] Properties to set
         */
        constructor(properties?: archcanvas.IAIConversation);

        /** AIConversation id. */
        public id: string;

        /** AIConversation scopedToNodeId. */
        public scopedToNodeId: string;

        /** AIConversation messages. */
        public messages: archcanvas.IAIMessage[];

        /** AIConversation createdAtMs. */
        public createdAtMs: (number|Long);

        /**
         * Creates a new AIConversation instance using the specified properties.
         * @param [properties] Properties to set
         * @returns AIConversation instance
         */
        public static create(properties?: archcanvas.IAIConversation): archcanvas.AIConversation;

        /**
         * Encodes the specified AIConversation message. Does not implicitly {@link archcanvas.AIConversation.verify|verify} messages.
         * @param message AIConversation message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: archcanvas.IAIConversation, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified AIConversation message, length delimited. Does not implicitly {@link archcanvas.AIConversation.verify|verify} messages.
         * @param message AIConversation message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: archcanvas.IAIConversation, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a AIConversation message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns AIConversation
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): archcanvas.AIConversation;

        /**
         * Decodes a AIConversation message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns AIConversation
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): archcanvas.AIConversation;

        /**
         * Verifies a AIConversation message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a AIConversation message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns AIConversation
         */
        public static fromObject(object: { [k: string]: any }): archcanvas.AIConversation;

        /**
         * Creates a plain object from a AIConversation message. Also converts values to other types if specified.
         * @param message AIConversation
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: archcanvas.AIConversation, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this AIConversation to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for AIConversation
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a AIMessage. */
    interface IAIMessage {

        /** AIMessage id */
        id?: (string|null);

        /** AIMessage role */
        role?: (string|null);

        /** AIMessage content */
        content?: (string|null);

        /** AIMessage timestampMs */
        timestampMs?: (number|Long|null);

        /** AIMessage suggestions */
        suggestions?: (archcanvas.IAISuggestion[]|null);
    }

    /** Represents a AIMessage. */
    class AIMessage implements IAIMessage {

        /**
         * Constructs a new AIMessage.
         * @param [properties] Properties to set
         */
        constructor(properties?: archcanvas.IAIMessage);

        /** AIMessage id. */
        public id: string;

        /** AIMessage role. */
        public role: string;

        /** AIMessage content. */
        public content: string;

        /** AIMessage timestampMs. */
        public timestampMs: (number|Long);

        /** AIMessage suggestions. */
        public suggestions: archcanvas.IAISuggestion[];

        /**
         * Creates a new AIMessage instance using the specified properties.
         * @param [properties] Properties to set
         * @returns AIMessage instance
         */
        public static create(properties?: archcanvas.IAIMessage): archcanvas.AIMessage;

        /**
         * Encodes the specified AIMessage message. Does not implicitly {@link archcanvas.AIMessage.verify|verify} messages.
         * @param message AIMessage message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: archcanvas.IAIMessage, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified AIMessage message, length delimited. Does not implicitly {@link archcanvas.AIMessage.verify|verify} messages.
         * @param message AIMessage message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: archcanvas.IAIMessage, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a AIMessage message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns AIMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): archcanvas.AIMessage;

        /**
         * Decodes a AIMessage message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns AIMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): archcanvas.AIMessage;

        /**
         * Verifies a AIMessage message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a AIMessage message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns AIMessage
         */
        public static fromObject(object: { [k: string]: any }): archcanvas.AIMessage;

        /**
         * Creates a plain object from a AIMessage message. Also converts values to other types if specified.
         * @param message AIMessage
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: archcanvas.AIMessage, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this AIMessage to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for AIMessage
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a AISuggestion. */
    interface IAISuggestion {

        /** AISuggestion id */
        id?: (string|null);

        /** AISuggestion targetNodeId */
        targetNodeId?: (string|null);

        /** AISuggestion targetEdgeId */
        targetEdgeId?: (string|null);

        /** AISuggestion suggestionType */
        suggestionType?: (string|null);

        /** AISuggestion content */
        content?: (string|null);

        /** AISuggestion status */
        status?: (archcanvas.Note.NoteStatus|null);
    }

    /** Represents a AISuggestion. */
    class AISuggestion implements IAISuggestion {

        /**
         * Constructs a new AISuggestion.
         * @param [properties] Properties to set
         */
        constructor(properties?: archcanvas.IAISuggestion);

        /** AISuggestion id. */
        public id: string;

        /** AISuggestion targetNodeId. */
        public targetNodeId: string;

        /** AISuggestion targetEdgeId. */
        public targetEdgeId: string;

        /** AISuggestion suggestionType. */
        public suggestionType: string;

        /** AISuggestion content. */
        public content: string;

        /** AISuggestion status. */
        public status: archcanvas.Note.NoteStatus;

        /**
         * Creates a new AISuggestion instance using the specified properties.
         * @param [properties] Properties to set
         * @returns AISuggestion instance
         */
        public static create(properties?: archcanvas.IAISuggestion): archcanvas.AISuggestion;

        /**
         * Encodes the specified AISuggestion message. Does not implicitly {@link archcanvas.AISuggestion.verify|verify} messages.
         * @param message AISuggestion message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: archcanvas.IAISuggestion, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified AISuggestion message, length delimited. Does not implicitly {@link archcanvas.AISuggestion.verify|verify} messages.
         * @param message AISuggestion message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: archcanvas.IAISuggestion, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a AISuggestion message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns AISuggestion
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): archcanvas.AISuggestion;

        /**
         * Decodes a AISuggestion message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns AISuggestion
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): archcanvas.AISuggestion;

        /**
         * Verifies a AISuggestion message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a AISuggestion message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns AISuggestion
         */
        public static fromObject(object: { [k: string]: any }): archcanvas.AISuggestion;

        /**
         * Creates a plain object from a AISuggestion message. Also converts values to other types if specified.
         * @param message AISuggestion
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: archcanvas.AISuggestion, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this AISuggestion to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for AISuggestion
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an UndoHistory. */
    interface IUndoHistory {

        /** UndoHistory entries */
        entries?: (archcanvas.IUndoEntry[]|null);

        /** UndoHistory currentIndex */
        currentIndex?: (number|null);

        /** UndoHistory maxEntries */
        maxEntries?: (number|null);
    }

    /** Represents an UndoHistory. */
    class UndoHistory implements IUndoHistory {

        /**
         * Constructs a new UndoHistory.
         * @param [properties] Properties to set
         */
        constructor(properties?: archcanvas.IUndoHistory);

        /** UndoHistory entries. */
        public entries: archcanvas.IUndoEntry[];

        /** UndoHistory currentIndex. */
        public currentIndex: number;

        /** UndoHistory maxEntries. */
        public maxEntries: number;

        /**
         * Creates a new UndoHistory instance using the specified properties.
         * @param [properties] Properties to set
         * @returns UndoHistory instance
         */
        public static create(properties?: archcanvas.IUndoHistory): archcanvas.UndoHistory;

        /**
         * Encodes the specified UndoHistory message. Does not implicitly {@link archcanvas.UndoHistory.verify|verify} messages.
         * @param message UndoHistory message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: archcanvas.IUndoHistory, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified UndoHistory message, length delimited. Does not implicitly {@link archcanvas.UndoHistory.verify|verify} messages.
         * @param message UndoHistory message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: archcanvas.IUndoHistory, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an UndoHistory message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns UndoHistory
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): archcanvas.UndoHistory;

        /**
         * Decodes an UndoHistory message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns UndoHistory
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): archcanvas.UndoHistory;

        /**
         * Verifies an UndoHistory message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an UndoHistory message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns UndoHistory
         */
        public static fromObject(object: { [k: string]: any }): archcanvas.UndoHistory;

        /**
         * Creates a plain object from an UndoHistory message. Also converts values to other types if specified.
         * @param message UndoHistory
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: archcanvas.UndoHistory, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this UndoHistory to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for UndoHistory
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an UndoEntry. */
    interface IUndoEntry {

        /** UndoEntry description */
        description?: (string|null);

        /** UndoEntry timestampMs */
        timestampMs?: (number|Long|null);

        /** UndoEntry architectureSnapshot */
        architectureSnapshot?: (Uint8Array|null);
    }

    /** Represents an UndoEntry. */
    class UndoEntry implements IUndoEntry {

        /**
         * Constructs a new UndoEntry.
         * @param [properties] Properties to set
         */
        constructor(properties?: archcanvas.IUndoEntry);

        /** UndoEntry description. */
        public description: string;

        /** UndoEntry timestampMs. */
        public timestampMs: (number|Long);

        /** UndoEntry architectureSnapshot. */
        public architectureSnapshot: Uint8Array;

        /**
         * Creates a new UndoEntry instance using the specified properties.
         * @param [properties] Properties to set
         * @returns UndoEntry instance
         */
        public static create(properties?: archcanvas.IUndoEntry): archcanvas.UndoEntry;

        /**
         * Encodes the specified UndoEntry message. Does not implicitly {@link archcanvas.UndoEntry.verify|verify} messages.
         * @param message UndoEntry message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: archcanvas.IUndoEntry, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified UndoEntry message, length delimited. Does not implicitly {@link archcanvas.UndoEntry.verify|verify} messages.
         * @param message UndoEntry message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: archcanvas.IUndoEntry, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an UndoEntry message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns UndoEntry
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): archcanvas.UndoEntry;

        /**
         * Decodes an UndoEntry message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns UndoEntry
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): archcanvas.UndoEntry;

        /**
         * Verifies an UndoEntry message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an UndoEntry message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns UndoEntry
         */
        public static fromObject(object: { [k: string]: any }): archcanvas.UndoEntry;

        /**
         * Creates a plain object from an UndoEntry message. Also converts values to other types if specified.
         * @param message UndoEntry
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: archcanvas.UndoEntry, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this UndoEntry to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for UndoEntry
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Value. */
    interface IValue {

        /** Value stringValue */
        stringValue?: (string|null);

        /** Value numberValue */
        numberValue?: (number|null);

        /** Value boolValue */
        boolValue?: (boolean|null);

        /** Value stringListValue */
        stringListValue?: (archcanvas.IStringList|null);
    }

    /** Represents a Value. */
    class Value implements IValue {

        /**
         * Constructs a new Value.
         * @param [properties] Properties to set
         */
        constructor(properties?: archcanvas.IValue);

        /** Value stringValue. */
        public stringValue?: (string|null);

        /** Value numberValue. */
        public numberValue?: (number|null);

        /** Value boolValue. */
        public boolValue?: (boolean|null);

        /** Value stringListValue. */
        public stringListValue?: (archcanvas.IStringList|null);

        /** Value kind. */
        public kind?: ("stringValue"|"numberValue"|"boolValue"|"stringListValue");

        /**
         * Creates a new Value instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Value instance
         */
        public static create(properties?: archcanvas.IValue): archcanvas.Value;

        /**
         * Encodes the specified Value message. Does not implicitly {@link archcanvas.Value.verify|verify} messages.
         * @param message Value message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: archcanvas.IValue, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Value message, length delimited. Does not implicitly {@link archcanvas.Value.verify|verify} messages.
         * @param message Value message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: archcanvas.IValue, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Value message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Value
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): archcanvas.Value;

        /**
         * Decodes a Value message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Value
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): archcanvas.Value;

        /**
         * Verifies a Value message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Value message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Value
         */
        public static fromObject(object: { [k: string]: any }): archcanvas.Value;

        /**
         * Creates a plain object from a Value message. Also converts values to other types if specified.
         * @param message Value
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: archcanvas.Value, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Value to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Value
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a StringList. */
    interface IStringList {

        /** StringList values */
        values?: (string[]|null);
    }

    /** Represents a StringList. */
    class StringList implements IStringList {

        /**
         * Constructs a new StringList.
         * @param [properties] Properties to set
         */
        constructor(properties?: archcanvas.IStringList);

        /** StringList values. */
        public values: string[];

        /**
         * Creates a new StringList instance using the specified properties.
         * @param [properties] Properties to set
         * @returns StringList instance
         */
        public static create(properties?: archcanvas.IStringList): archcanvas.StringList;

        /**
         * Encodes the specified StringList message. Does not implicitly {@link archcanvas.StringList.verify|verify} messages.
         * @param message StringList message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: archcanvas.IStringList, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified StringList message, length delimited. Does not implicitly {@link archcanvas.StringList.verify|verify} messages.
         * @param message StringList message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: archcanvas.IStringList, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a StringList message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns StringList
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): archcanvas.StringList;

        /**
         * Decodes a StringList message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns StringList
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): archcanvas.StringList;

        /**
         * Verifies a StringList message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a StringList message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns StringList
         */
        public static fromObject(object: { [k: string]: any }): archcanvas.StringList;

        /**
         * Creates a plain object from a StringList message. Also converts values to other types if specified.
         * @param message StringList
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: archcanvas.StringList, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this StringList to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for StringList
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }
}
