import { GraphQLString, buildASTSchema, parse } from 'graphql';
import { GraphQLBridge } from 'uniforms-bridge-graphql';

describe('GraphQLBridge', () => {
  const schemaI = `
        scalar Scalar

        enum AccessLevel {
            Admin
            User
        }

        input Author {
            id:        ID!
            confirmed: Boolean
            decimal1:  Float
            decimal2:  Float!
            firstName: String = "John"
            lastName:  String = "Doe"
            level:     AccessLevel
            tags:      [String]!
        }

        input Category {
            owners: [Author!]
        }

        input Post {
            id:       Int!
            author:   Author!
            custom:   Scalar
            title:    String
            votes:    Int
            example:  ID
            category: [Category!]!
        }

        # This is required by buildASTSchema
        type Query { anything: ID }
    `;

  const schemaT = schemaI.replace(/input/g, 'type').replace(/\s*=.+/g, '');

  const schemaData = {
    author: { component: 'div' },
    'author.tags.$': { initialValue: 'x' },
    id: {
      allowedValues: [1, 2, 3],
      label: 'Post ID',
      placeholder: 'Post ID',
    },
    title: {
      initialValue: 'Some Title',
      label: false,
      options: [
        { label: 1, value: 'a' },
        { label: 2, value: 'b' },
        { label: 3, value: 'Some Title' },
      ],
    },
    votes: {
      initialValue: 44,
      options: {
        a: 1,
        b: 2,
        c: 44,
      },
    },
  };

  const schemaValidator = jest.fn();

  const astI = buildASTSchema(parse(schemaI));
  const astT = buildASTSchema(parse(schemaT));

  const bridgeI = new GraphQLBridge(
    astI.getType('Post')!,
    schemaValidator,
    schemaData,
  );
  const bridgeT = new GraphQLBridge(
    astT.getType('Post')!,
    schemaValidator,
    schemaData,
  );

  describe('#constructor()', () => {
    it('always ensures `extras`', () => {
      const bridge = new GraphQLBridge(astI.getType('Post')!, schemaValidator);
      expect(bridge.extras).toEqual({});
    });
  });

  describe('#getError', () => {
    it('works without error', () => {
      expect(bridgeI.getError('title', undefined)).toBe(null);
    });

    it('works with invalid error', () => {
      expect(bridgeI.getError('title', {})).toBe(null);
      expect(bridgeI.getError('title', { invalid: true })).toBe(null);
    });

    it('works with correct error', () => {
      expect(
        bridgeI.getError('title', { details: [{ name: 'title' }] }),
      ).toEqual({ name: 'title' });
      expect(bridgeI.getError('title', { details: [{ name: 'field' }] })).toBe(
        null,
      );
    });
  });

  describe('#getErrorMessage', () => {
    it('works without error', () => {
      expect(bridgeI.getErrorMessage('title', undefined)).toBe('');
    });

    it('works with invalid error', () => {
      expect(bridgeI.getErrorMessage('title', {})).toBe('');
      expect(bridgeI.getErrorMessage('title', { invalid: true })).toBe('');
    });

    it('works with correct error', () => {
      expect(
        bridgeI.getErrorMessage('title', {
          details: [{ name: 'title', message: '!' }],
        }),
      ).toBe('!');
      expect(
        bridgeI.getErrorMessage('title', {
          details: [{ name: 'field', message: '$' }],
        }),
      ).toBe('');
    });
  });

  describe('#getErrorMessages', () => {
    it('works without error', () => {
      expect(bridgeI.getErrorMessages(null)).toEqual([]);
      expect(bridgeI.getErrorMessages(undefined)).toEqual([]);
    });

    it('works with other errors', () => {
      expect(bridgeI.getErrorMessages('correct')).toEqual(['correct']);
      expect(bridgeI.getErrorMessages(999999999)).toEqual([999999999]);
    });

    it('works with Error', () => {
      expect(bridgeI.getErrorMessages(new Error('correct'))).toEqual([
        'correct',
      ]);
    });

    it('works with ValidationError', () => {
      expect(
        bridgeI.getErrorMessages({
          details: [{ name: 'title', message: '!' }],
        }),
      ).toEqual(['!']);
      expect(
        bridgeI.getErrorMessages({
          details: [{ name: 'field', message: '$' }],
        }),
      ).toEqual(['$']);
    });
  });

  describe('#getField', () => {
    it('return correct definition (input)', () => {
      expect(bridgeI.getField('author.firstName')).toEqual({
        astNode: expect.objectContaining({}),
        defaultValue: 'John',
        description: undefined,
        name: 'firstName',
        type: GraphQLString,
      });
    });

    it('return correct definition (type)', () => {
      expect(bridgeT.getField('author.firstName')).toEqual({
        args: [],
        astNode: expect.objectContaining({}),
        deprecationReason: undefined,
        description: undefined,
        isDeprecated: false,
        name: 'firstName',
        type: GraphQLString,
      });
    });

    it('throws on not found field', () => {
      const error = /Field not found in schema/;
      expect(() => bridgeI.getField('x')).toThrow(error);
      expect(() => bridgeI.getField('author.x')).toThrow(error);
      expect(() => bridgeI.getField('author.tags.x')).toThrow(error);
    });
  });

  describe('#getInitialValue', () => {
    it('works with arrays', () => {
      expect(bridgeI.getInitialValue('author.tags')).toEqual([]);
    });

    it('works with objects', () => {
      expect(bridgeI.getInitialValue('author')).toEqual({
        firstName: 'John',
        lastName: 'Doe',
        tags: [],
      });
    });

    it('works with undefined primitives', () => {
      expect(bridgeI.getInitialValue('id')).toBe(undefined);
    });

    it('works with defined primitives', () => {
      expect(bridgeI.getInitialValue('votes')).toBe(44);
    });

    it('works with default values', () => {
      expect(bridgeI.getInitialValue('author.firstName')).toBe('John');
    });
  });

  describe('#getProps', () => {
    describe('labels are derived properly', () => {
      describe('when props.label is undefined or true', () => {
        describe('and no extra data is passed', () => {
          it('should use AST field name', () => {
            expect(bridgeT.getProps('title')).toEqual({
              allowedValues: ['a', 'b', 'Some Title'],
              label: false,
              required: false,
              transform: expect.any(Function),
              options: [
                { label: 1, value: 'a' },
                { label: 2, value: 'b' },
                { label: 3, value: 'Some Title' },
              ],
              initialValue: 'Some Title',
            });
            expect(bridgeT.getProps('author.decimal1')).toEqual({
              decimal: true,
              label: 'Decimal 1',
              required: false,
            });
            expect(bridgeT.getProps('author.firstName')).toEqual({
              label: 'First name',
              required: false,
            });
          });
        });

        describe('and extra data is present', () => {
          it('should use extra data', () => {
            expect(bridgeT.getProps('id')).toEqual({
              allowedValues: [1, 2, 3],
              label: 'Post ID',
              placeholder: 'Post ID',
              required: true,
            });
          });
        });
      });
    });

    it('works with allowedValues', () => {
      expect(bridgeI.getProps('id')).toEqual({
        label: 'Post ID',
        placeholder: 'Post ID',
        required: true,
        allowedValues: [1, 2, 3],
      });
    });

    it('works with custom component', () => {
      expect(bridgeI.getProps('author')).toEqual({
        label: 'Author',
        required: true,
        component: 'div',
      });
    });

    it('works with Number type', () => {
      expect(bridgeI.getProps('author.decimal1')).toEqual({
        label: 'Decimal 1',
        required: false,
        decimal: true,
      });

      expect(bridgeI.getProps('author.decimal2')).toEqual({
        label: 'Decimal 2',
        required: true,
        decimal: true,
      });
    });

    it('works with options (array)', () => {
      expect(bridgeI.getProps('title').transform('a')).toBe(1);
      expect(bridgeI.getProps('title').transform('b')).toBe(2);
      expect(bridgeI.getProps('title').allowedValues[0]).toBe('a');
      expect(bridgeI.getProps('title').allowedValues[1]).toBe('b');
    });

    it('works with options (object)', () => {
      expect(bridgeI.getProps('votes').transform('a')).toBe(1);
      expect(bridgeI.getProps('votes').transform('b')).toBe(2);
      expect(bridgeI.getProps('votes').allowedValues[0]).toBe('a');
      expect(bridgeI.getProps('votes').allowedValues[1]).toBe('b');
    });

    describe('when enum', () => {
      it('should return possibleValues', () => {
        expect(bridgeI.getProps('author.level').allowedValues).toEqual([
          'Admin',
          'User',
        ]);
      });

      it('should transform the value to the name', () => {
        const transform = bridgeI.getProps('author.level').transform;
        expect(transform('Admin')).toBe('Admin');
      });

      it('should prefer options over enum', () => {
        const bridge = new GraphQLBridge(
          astI.getType('Post')!,
          schemaValidator,
          {
            ...schemaData,
            'author.level': {
              options: [
                { label: 'A', value: 'a' },
                { label: 'B', value: 'b' },
              ],
            },
          },
        );
        const { allowedValues, transform } = bridge.getProps('author.level');
        expect(allowedValues).toEqual(['a', 'b']);
        expect(transform('a')).toEqual('A');
        expect(transform('b')).toEqual('B');
      });
    });
  });

  describe('#getSubfields', () => {
    it('works on top level', () => {
      expect(bridgeI.getSubfields()).toEqual([
        'id',
        'author',
        'custom',
        'title',
        'votes',
        'example',
        'category',
      ]);
    });

    it('works with nested types', () => {
      expect(bridgeI.getSubfields('author')).toEqual([
        'id',
        'confirmed',
        'decimal1',
        'decimal2',
        'firstName',
        'lastName',
        'level',
        'tags',
      ]);
    });

    it('works with primitives', () => {
      expect(bridgeI.getSubfields('id')).toEqual([]);
      expect(bridgeI.getSubfields('author.id')).toEqual([]);
    });
  });

  describe('#getType', () => {
    [
      [astI, bridgeI, 'input'] as const,
      [astT, bridgeT, 'type'] as const,
    ].forEach(([ast, bridge, mode]) => {
      it(`works with any type (${mode})`, () => {
        expect(bridge.getType('author')).toBe(Object);
        expect(bridge.getType('author.confirmed')).toBe(Boolean);
        expect(bridge.getType('author.decimal1')).toBe(Number);
        expect(bridge.getType('author.decimal2')).toBe(Number);
        expect(bridge.getType('author.firstName')).toBe(String);
        expect(bridge.getType('author.id')).toBe(String);
        expect(bridge.getType('author.lastName')).toBe(String);
        expect(bridge.getType('author.level')).toBe(ast.getType('AccessLevel'));
        expect(bridge.getType('author.tags')).toBe(Array);
        expect(bridge.getType('author.tags.$')).toBe(String);
        expect(bridge.getType('category')).toBe(Array);
        expect(bridge.getType('category.$')).toBe(Object);
        expect(bridge.getType('category.$.owners')).toBe(Array);
        expect(bridge.getType('category.$.owners.$')).toBe(Object);
        expect(bridge.getType('category.$.owners.$.decimal1')).toBe(Number);
        expect(bridge.getType('category.$.owners.$.decimal2')).toBe(Number);
        expect(bridge.getType('category.$.owners.$.firstName')).toBe(String);
        expect(bridge.getType('category.$.owners.$.id')).toBe(String);
        expect(bridge.getType('category.$.owners.$.lastName')).toBe(String);
        expect(bridge.getType('category.$.owners.$.tags')).toBe(Array);
        expect(bridge.getType('category.$.owners.$.tags.$')).toBe(String);
        expect(bridge.getType('category.1.owners.$.tags.$')).toBe(String);
        expect(bridge.getType('category.$.owners.2.tags.$')).toBe(String);
        expect(bridge.getType('category.$.owners.$.tags.3')).toBe(String);
        expect(bridge.getType('category.4.owners.5.tags.$')).toBe(String);
        expect(bridge.getType('category.6.owners.$.tags.7')).toBe(String);
        expect(bridge.getType('category.$.owners.8.tags.9')).toBe(String);
        expect(bridge.getType('category.0.owners.0.tags.0')).toBe(String);
        expect(bridge.getType('custom')).toBe(ast.getType('Scalar'));
        expect(bridge.getType('example')).toBe(String);
        expect(bridge.getType('id')).toBe(Number);
        expect(bridge.getType('title')).toBe(String);
        expect(bridge.getType('votes')).toBe(Number);
      });
    });
  });

  describe('#getValidator', () => {
    it('calls correct validator', () => {
      expect(bridgeI.getValidator()).toBe(schemaValidator);
    });
  });
});
