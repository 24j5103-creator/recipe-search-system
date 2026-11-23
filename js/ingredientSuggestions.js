import {
    splitIngredientNames,
    splitLastIngredient,
    toKatakana
} from "./recipeSearch.js";

// 一度に出す候補の数（スマホでキーボードに隠れにくい数にする）
const MAX_SUGGESTIONS = 6;

// 検索欄に入力候補をつなぐ
// input：検索欄、listbox：候補を入れる ul、liveRegion：読み上げ用の領域
// recipeSearch：RecipeSearch（読み込み後のもの）
export function setupIngredientSuggestions({
    input,
    listbox,
    liveRegion,
    recipeSearch
}) {
    // 今出している候補と、↑↓で選んでいる候補の番号（-1 は未選択）
    let suggestions = [];
    let activeIndex = -1;

    // 候補の id を作る（aria-activedescendant で指すため）
    function optionId(index) {
        return `${listbox.id}-option-${index}`;
    }

    // 読み上げ用の文を更新する（同じ件数なら変えず、1文字ごとに読み上げないようにする）
    function announce(count) {
        const text = count === 0
            ? ""
            : `候補が${count}件あります。上下キーで選べます。`;

        if (liveRegion.textContent !== text) {
            liveRegion.textContent = text;
        }
    }

    // 候補を閉じる
    function close() {
        suggestions = [];
        activeIndex = -1;

        listbox.replaceChildren();
        listbox.hidden = true;

        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");

        announce(0);
    }

    // 選んでいる候補の見た目と ARIA 属性をそろえる
    function updateActive() {
        const options = listbox.querySelectorAll("[role='option']");

        options.forEach((option, index) => {
            option.setAttribute(
                "aria-selected",
                index === activeIndex ? "true" : "false"
            );
        });

        if (activeIndex === -1) {
            input.removeAttribute("aria-activedescendant");
        } else {
            input.setAttribute("aria-activedescendant", optionId(activeIndex));
        }
    }

    // 入力内容から候補を作り直して表示する
    function update() {
        const { before, last } = splitLastIngredient(input.value);

        // すでに入れた食材は候補に出さない（ひらがなで入れた分もカタカナで比べる）
        const entered = splitIngredientNames(before).map(toKatakana);

        suggestions = recipeSearch.suggestIngredients(
            last,
            entered,
            MAX_SUGGESTIONS
        );
        activeIndex = -1;

        if (suggestions.length === 0) {
            close();
            return;
        }

        const items = suggestions.map((suggestion, index) => {
            const item = document.createElement("li");
            item.id = optionId(index);
            item.setAttribute("role", "option");
            item.setAttribute("aria-selected", "false");

            const name = document.createElement("span");
            name.className = "suggestion-name";
            name.textContent = suggestion.ingredientName;

            const count = document.createElement("span");
            count.className = "suggestion-count";
            count.textContent = `料理${suggestion.recipeCount}件`;

            item.append(name, count);

            // タップ・クリックで選ぶ
            item.addEventListener("click", () => {
                choose(index);
            });

            return item;
        });

        listbox.replaceChildren(...items);
        listbox.hidden = false;
        input.setAttribute("aria-expanded", "true");
        input.removeAttribute("aria-activedescendant");

        announce(suggestions.length);
    }

    // 候補を選び、最後の食材だけを置きかえる
    function choose(index) {
        const suggestion = suggestions[index];

        if (!suggestion) {
            return;
        }

        const { before } = splitLastIngredient(input.value);
        input.value = before + suggestion.ingredientName;

        close();

        // カーソルは検索欄の最後に置く（続けて区切りと次の食材を打てるように）
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }

    // 打つたびに候補を更新する（IMEで変換中の文字にも反応する）
    input.addEventListener("input", update);

    input.addEventListener("keydown", event => {
        // IMEで変換中のキーは IME の操作なので、候補では使わない
        if (event.isComposing || event.keyCode === 229) {
            return;
        }

        if (listbox.hidden) {
            return;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            activeIndex = (activeIndex + 1) % suggestions.length;
            updateActive();
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            activeIndex = activeIndex <= 0
                ? suggestions.length - 1
                : activeIndex - 1;
            updateActive();
        } else if (event.key === "Enter" && activeIndex !== -1) {
            // 候補を選んでいるときだけ、検索ではなく候補を選ぶ
            event.preventDefault();
            choose(activeIndex);
        } else if (event.key === "Escape") {
            event.preventDefault();
            close();
        }
    });

    // 検索欄から離れたら閉じる
    input.addEventListener("blur", close);

    // 候補を押した瞬間に検索欄のフォーカスが外れると、クリックが効かなくなるので防ぐ
    listbox.addEventListener("pointerdown", event => {
        event.preventDefault();
    });

    // 検索したら候補を閉じる
    if (input.form) {
        input.form.addEventListener("submit", close);
    }

    close();
}
