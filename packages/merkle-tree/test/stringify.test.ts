import { stringify } from '../src';

describe('Stringify', () => {
  it('should stringify simple object and sort keys', () => {
    const obj = {
      name: 'object',
      id: 1,
    };
    const s = stringify(obj);
    expect(s === '{"id":1,"name":"object"}').toBe(true);
  });

  it('should omit values other then string, number and nested objects with these values', () => {
    const obj = {
      name: 'object',
      id: 1,
      bark: () => {
        console.log('Woof woof');
      },
      empty: null,
    };
    const s = stringify(obj as any);
    expect(s === '{"id":1,"name":"object"}').toBe(true);
  });

  it('should stringify nested objects', () => {
    const obj = {
      id: 1,
      name: 'object',
      props: {
        value: 10,
        bad: false,
        timestamp: new Date('2022-09-05T14:09:29.260Z'),
        nested: {
          fine: true,
          a: 1,
        },
      },
    };
    const s = stringify(obj);
    expect(s === '{"id":1,"name":"object","props":{"bad":false,"nested":{"a":1,"fine":true},"timestamp":"2022-09-05T14:09:29.260Z","value":10}}').toBe(true);
  });

  it('should stringify objects containing arrays', () => {
    const obj = {
      id: 1,
      name: 'object',
      props: {
        value: 10,
        properties: [
          {
            id: 1,
            bad: false,
          },
          {
            id: 2,
            bad: true,
          },
          {
            id: 3,
            bad: false,
            optional: [1, 4, 2, 6, 3],
          },
        ],
        bad: false,
        nested: {
          fine: true,
          a: 1,
        },
      },
    };
    const s = stringify(obj);
    expect(s === '{"id":1,"name":"object","props":{"bad":false,"nested":{"a":1,"fine":true},"properties":[{"bad":false,"id":1},{"bad":false,"id":3,"optional":[1,2,3,4,6]},{"bad":true,"id":2}],"value":10}}').toBe(true);
  });
});
