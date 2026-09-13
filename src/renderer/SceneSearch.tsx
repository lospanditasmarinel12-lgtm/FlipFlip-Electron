import * as React from "react";
import CreatableSelect from "react-select/creatable";

import Scene from "./data/Scene";

class SceneSearch extends React.Component {
  readonly props: {
    displaySources: Array<Scene>,
    filters: Array<string>,
    placeholder: string,
    onUpdateFilters(filter: Array<string>): void,
  };

  readonly state = {
    searchInput: "",
    options: Array<{ label: string, value: string }>(),
    defaultValues: Array<{ label: string, value: string }>(),
  };

  render() {
    return (
      <CreatableSelect
        className="CreatableSelect"
        components={{DropdownIndicator: null,}}
        value={this.state.defaultValues}
        options={this.state.options}
        inputValue={this.state.searchInput}
        isClearable
        isMulti
        rightAligned
        placeholder={this.props.placeholder}
        formatCreateLabel={(input: string) => "Search for " + input}
        onChange={this.handleChange}
        onInputChange={this.handleInputChange}
      />
    );
  }

  componentDidMount() {
    this.update();
  }

  componentDidUpdate(props: any) {
    if (props) {
      if (props.filters != this.props.filters ||
        props.displaySources != this.props.displaySources) {
        this.update();
      }
    }
  }

  update() {
    const options = Array<{ label: string, value: string }>();
    const defaultValues = Array<{ label: string, value: string }>();
    for (let filter of this.props.filters) {
      const opt = {label: filter, value: filter};
      options.push(opt);
      defaultValues.push(opt);
    }
    this.setState({options: options, defaultValues: defaultValues})
  }

  handleChange = (search: [{label: string, value: string}]) => {
    if (search == null) {
      this.props.onUpdateFilters([]);
    } else {
      let filters = Array<string>();
      for (let s of search) {
        if (((s.value.startsWith('"') || s.value.startsWith('-"')) && s.value.endsWith('"')) ||
          ((s.value.startsWith('\'') || s.value.startsWith('-\'')) && s.value.endsWith('\''))) {
          filters = filters.concat(s.value);
        } else {
          filters = filters.concat(s.value.split(" "));
        }
      }
      this.props.onUpdateFilters(filters);
    }
  };

  handleInputChange = (searchInput: string) => {
    this.setState({searchInput})
  };
}

(SceneSearch as any).displayName="SceneSearch";
export default SceneSearch;